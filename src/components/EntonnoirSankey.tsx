"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Pole } from "@/lib/types";
import { cx } from "@/components/ui";

/**
 * Entonnoir de prospection, en diagramme de Sankey.
 *
 * Les compteurs du tableau de bord disent combien d'entreprises sont dans
 * chaque statut, mais pas comment le portefeuille se rétrécit d'une étape à
 * la suivante. C'est pourtant là qu'on voit d'un coup d'œil que la moitié des
 * entreprises n'a jamais été contactée, ou que les relances ne suivent pas le
 * stock d'entreprises en attente.
 *
 * Le diagramme lit le statut ACTUEL de chaque entreprise et le met en forme
 * d'entonnoir. Il ne rejoue pas les transitions réelles dans le temps : le
 * journal ne conserve pas l'ancien statut, donc un vrai flux historique n'est
 * pas reconstructible aujourd'hui. L'entête le dit à l'utilisateur.
 */

/** Comptage par pôle (clé = id du pôle, ou « none ») puis par statut. */
export type ParPoleStatut = Record<string, Record<string, number>>;

type Noeud = {
  cle: string;
  col: number;
  valeur: number;
  nom: string;
  sous?: string;
  couleur: string;
  /** Statut vers lequel pointer au clic, quand le nœud en représente un seul. */
  statut?: string;
  y0: number;
  y1: number;
  h: number;
  x: number;
  offset: number;
};

type Lien = { source: string; cible: string; valeur: number };

/* ------------------------------------------------------------------ */
/*  Géométrie                                                          */
/* ------------------------------------------------------------------ */

const LARGEUR = 1180;
const HAUTEUR = 520;
const COLONNES = [10, 298, 618, 898];
const EPAISSEUR = 10;          // largeur d'une barre de nœud
const HAUT = 24;
const BAS = HAUTEUR - 22;
const ECART = 12;              // espace minimal entre deux barres
const MINI = 6;                // épaisseur plancher d'un nœud, sinon il disparaît
const PAS = 38;                // distance minimale entre deux centres, pour les étiquettes
const LARGEUR_CLIC = 250;      // largeur de la zone cliquable : la barre plus son étiquette

/**
 * Construit les nœuds et les liens à partir d'un comptage par statut.
 *
 * Les statuts inconnus (par exemple « contact_en_cours », retiré de
 * l'interface mais encore possible en base) sont versés dans « sans réponse »
 * plutôt qu'ignorés : un total qui ne tombe pas juste rendrait le diagramme
 * faux sans que personne ne le voie.
 */
function modele(c: Record<string, number>) {
  const n = (k: string) => c[k] ?? 0;
  const connus = [
    "a_identifier", "a_contacter", "abandonne", "en_attente",
    "relance", "relance_faite", "positif", "en_discussion", "visite_confirmee", "refus",
  ];
  const autres = Object.entries(c)
    .filter(([k]) => !connus.includes(k))
    .reduce((s, [, v]) => s + v, 0);

  const enAttente = n("en_attente") + autres;
  const silence = enAttente + n("relance") + n("relance_faite");
  const reponse = n("positif") + n("en_discussion") + n("visite_confirmee") + n("refus");
  const contactees = silence + reponse;
  const total = contactees + n("a_identifier") + n("a_contacter") + n("abandonne");

  const brut: Omit<Noeud, "y0" | "y1" | "h" | "x" | "offset">[] = [
    { cle: "porte", col: 0, valeur: total, nom: "Portefeuille", couleur: "var(--sk-structure)" },
    { cle: "ident", col: 1, valeur: n("a_identifier"), nom: "À identifier", sous: "aucun interlocuteur", couleur: "var(--sk-ident)", statut: "a_identifier" },
    { cle: "contacter", col: 1, valeur: n("a_contacter"), nom: "À contacter", sous: "interlocuteur trouvé", couleur: "var(--sk-contacter)", statut: "a_contacter" },
    { cle: "contactees", col: 1, valeur: contactees, nom: "Contactées", couleur: "var(--sk-structure)" },
    { cle: "abandonne", col: 1, valeur: n("abandonne"), nom: "Abandonnées", couleur: "var(--sk-abandon)", statut: "abandonne" },
    { cle: "silence", col: 2, valeur: silence, nom: "Sans réponse", couleur: "var(--sk-attente)" },
    { cle: "reponse", col: 2, valeur: reponse, nom: "Réponse reçue", couleur: "var(--sk-positif)" },
    { cle: "attente", col: 3, valeur: enAttente, nom: "En attente", sous: "message parti", couleur: "var(--sk-attente)", statut: "en_attente" },
    { cle: "relance", col: 3, valeur: n("relance"), nom: "Relance nécessaire", couleur: "var(--sk-relance)", statut: "relance" },
    { cle: "relfaite", col: 3, valeur: n("relance_faite"), nom: "Relance faite", sous: "en attente", couleur: "var(--sk-relfaite)", statut: "relance_faite" },
    { cle: "visite", col: 3, valeur: n("visite_confirmee"), nom: "Visite confirmée", couleur: "var(--sk-visite)", statut: "visite_confirmee" },
    { cle: "positif", col: 3, valeur: n("positif"), nom: "Réponse positive", couleur: "var(--sk-positif)", statut: "positif" },
    { cle: "discussion", col: 3, valeur: n("en_discussion"), nom: "En discussion", couleur: "var(--sk-discussion)", statut: "en_discussion" },
    { cle: "refus", col: 3, valeur: n("refus"), nom: "Refus", couleur: "var(--sk-refus)", statut: "refus" },
  ];

  const noeuds: Record<string, Noeud> = {};
  brut.filter((b) => b.valeur > 0).forEach((b) => {
    noeuds[b.cle] = { ...b, y0: 0, y1: 0, h: 0, x: 0, offset: 0 };
  });

  const liens: Lien[] = ([
    ["porte", "ident"], ["porte", "contacter"], ["porte", "contactees"], ["porte", "abandonne"],
    ["contactees", "silence"], ["contactees", "reponse"],
    ["silence", "attente"], ["silence", "relance"], ["silence", "relfaite"],
    ["reponse", "visite"], ["reponse", "discussion"], ["reponse", "positif"], ["reponse", "refus"],
  ] as [string, string][])
    .filter(([s, t]) => noeuds[s] && noeuds[t])
    .map(([s, t]) => ({ source: s, cible: t, valeur: noeuds[t].valeur }));

  return { noeuds, liens, total, contactees, reponse, visites: n("visite_confirmee") };
}

/**
 * Place les nœuds verticalement.
 *
 * Deux contraintes se disputent la place : l'épaisseur doit rester
 * proportionnelle au nombre d'entreprises, et deux étiquettes ne doivent pas
 * se chevaucher. Sur les statuts rares (un refus, trois visites) la seconde
 * gagne : on écarte les centres d'au moins PAS pixels. Le chiffre exact est
 * écrit à côté de chaque nœud, donc l'écart ne trompe personne.
 */
function disposer(m: ReturnType<typeof modele>) {
  const colonnes: string[][] = [[], [], [], []];
  Object.values(m.noeuds).forEach((nd) => colonnes[nd.col].push(nd.cle));

  const plot = BAS - HAUT;
  const maxNoeuds = Math.max(1, ...colonnes.map((c) => c.length));
  const echelle = Math.max(0.1, (plot - ECART * (maxNoeuds - 1)) / Math.max(1, m.total));

  colonnes.forEach((cles, ci) => {
    if (cles.length === 0) return;
    const hs = cles.map((k) => Math.max(MINI, m.noeuds[k].valeur * echelle));
    const ys: number[] = [];
    cles.forEach((_, i) => {
      if (i === 0) { ys.push(0); return; }
      const basPrec = ys[i - 1] + hs[i - 1];
      const milieuPrec = ys[i - 1] + hs[i - 1] / 2;
      ys.push(Math.max(basPrec + ECART, milieuPrec + PAS - hs[i] / 2));
    });
    const etendue = ys[ys.length - 1] + hs[hs.length - 1];
    const decalage = HAUT + Math.max(0, (plot - etendue) / 2);
    cles.forEach((k, i) => {
      const nd = m.noeuds[k];
      nd.h = hs[i];
      nd.y0 = ys[i] + decalage;
      nd.y1 = nd.y0 + hs[i];
      nd.x = COLONNES[ci];
      nd.offset = 0;
    });
  });

  return m;
}

/** Ruban en cubiques : le côté source est réparti au prorata, le côté cible remplit le nœud. */
function ruban(l: Lien, m: ReturnType<typeof modele>) {
  const s = m.noeuds[l.source];
  const t = m.noeuds[l.cible];
  const x0 = s.x + EPAISSEUR;
  const x1 = t.x;
  const ep = s.h * (l.valeur / Math.max(1, s.valeur));
  const a0 = s.y0 + s.offset;
  const a1 = a0 + ep;
  s.offset += ep;
  const mx = (x0 + x1) / 2;   // point d'inflexion des cubiques, à mi-distance
  return `M${x0},${a0} C${mx},${a0} ${mx},${t.y0} ${x1},${t.y0} L${x1},${t.y1} C${mx},${t.y1} ${mx},${a1} ${x0},${a1} Z`;
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function EntonnoirSankey({
  parPoleStatut, poles,
}: { parPoleStatut: ParPoleStatut; poles: Pole[] }) {
  const router = useRouter();
  const [pole, setPole] = useState<string>("");   // "" = tous les pôles
  const [survol, setSurvol] = useState<{ x: number; y: number; texte: string } | null>(null);

  /** Pôles réellement représentés, plus « sans pôle » s'il y a lieu. */
  const onglets = useMemo(() => {
    const dispo = poles.filter((p) => parPoleStatut[p.id])
      .map((p) => ({ id: p.id, nom: p.name, couleur: p.color }));
    if (parPoleStatut.none) dispo.push({ id: "none", nom: "Sans pôle", couleur: "#98a1aa" });
    return dispo;
  }, [poles, parPoleStatut]);

  const { m, liens } = useMemo(() => {
    const cumul: Record<string, number> = {};
    const cles = pole ? [pole] : Object.keys(parPoleStatut);
    cles.forEach((k) => {
      Object.entries(parPoleStatut[k] ?? {}).forEach(([s, v]) => {
        cumul[s] = (cumul[s] ?? 0) + v;
      });
    });
    const mm = disposer(modele(cumul));
    // Les rubans sont tracés une seule fois : `ruban` consomme un offset par
    // nœud source, donc le calcul ne doit pas être rejoué au rendu suivant.
    const traces = mm.liens.map((l) => ({ lien: l, d: ruban(l, mm) }));
    return { m: mm, liens: traces };
  }, [parPoleStatut, pole]);

  if (m.total === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-400">
        Aucune entreprise à afficher.
      </p>
    );
  }

  const pct = (v: number) => Math.round((v / m.total) * 100);
  const suffixePole = pole && pole !== "none" ? `&pole=${pole}` : "";

  return (
    <div className="sankey relative">
      {/* Filtre par pôle : un seul diagramme, filtrable, plutôt que le pôle en
          première colonne — six pôles × neuf statuts donneraient un plat de
          spaghettis illisible dès le premier intervalle. */}
      {onglets.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pb-1 pt-4">
          <span className="label mr-1">Pôle</span>
          <Onglet actif={pole === ""} onClick={() => setPole("")}>Tous</Onglet>
          {onglets.map((o) => (
            <Onglet key={o.id} actif={pole === o.id} onClick={() => setPole(o.id)} couleur={o.couleur}>
              {o.nom}
            </Onglet>
          ))}
        </div>
      )}

      <div className="overflow-x-auto px-2 pb-2">
        <svg
          viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
          className="block h-auto w-full min-w-[900px]"
          role="img"
          aria-label={`Entonnoir de prospection : ${m.total} entreprises, ${m.contactees} contactées, ${m.reponse} réponses reçues, ${m.visites} visites confirmées.`}
        >
          <defs>
            {liens.map(({ lien }, i) => {
              const s = m.noeuds[lien.source];
              const t = m.noeuds[lien.cible];
              return (
                /* Les couleurs passent par `style` et non par les attributs de
                   présentation : un attribut SVG est lu comme une valeur SVG,
                   pas comme une valeur CSS, et `var()` n'y est pas résolu. */
                <linearGradient key={i} id={`sk-g-${i}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" style={{ stopColor: s.couleur, stopOpacity: "var(--sk-opacite)" }} />
                  <stop offset="1" style={{ stopColor: t.couleur, stopOpacity: "var(--sk-opacite)" }} />
                </linearGradient>
              );
            })}
          </defs>

          <g className="sk-rubans">
            {liens.map(({ lien, d }, i) => {
              const s = m.noeuds[lien.source];
              const t = m.noeuds[lien.cible];
              const texte = `${s.nom} → ${t.nom} : ${lien.valeur} entreprise${lien.valeur > 1 ? "s" : ""}`;
              return (
                <path
                  key={i}
                  d={d}
                  className="sk-ruban"
                  fill={`url(#sk-g-${i})`}
                  onMouseMove={(e) => setSurvol({ x: e.clientX, y: e.clientY, texte })}
                  onMouseLeave={() => setSurvol(null)}
                />
              );
            })}
          </g>

          {Object.values(m.noeuds).map((nd) => {
            const milieu = (nd.y0 + nd.y1) / 2;
            const lx = nd.x + EPAISSEUR + 11;
            const cliquable = Boolean(nd.statut);
            return (
              <g
                key={nd.cle}
                className={cx(cliquable && "cursor-pointer")}
                onClick={cliquable
                  ? () => router.push(`/entreprises?status=${nd.statut}${suffixePole}`)
                  : undefined}
              >
                {/* Une seule chaîne : un `<title>` SVG dont le texte est
                    découpé en plusieurs enfants ne se réhydrate pas. */}
                {cliquable && <title>{`Voir les ${nd.valeur} entreprises`}</title>}

                {/* Zone de clic invisible couvrant la barre ET son étiquette.
                    En SVG seules les zones peintes captent le pointeur : sans
                    ce rectangle, il faudrait viser une barre de 10 px de large
                    ou les lettres elles-mêmes, et un clic entre les deux se
                    perdrait. */}
                {cliquable && (
                  <rect
                    x={nd.x - 2}
                    y={Math.min(nd.y0, milieu - 15)}
                    width={LARGEUR_CLIC}
                    height={Math.max(nd.h, 30)}
                    fill="transparent"
                    style={{ pointerEvents: "all" }}
                  />
                )}
                <rect x={nd.x} y={nd.y0} width={EPAISSEUR} height={nd.h} rx={3} style={{ fill: nd.couleur }} />
                <text x={lx} y={milieu - 3} className="sk-nom">{nd.nom}</text>
                <text x={lx} y={milieu + 12} className="sk-val">
                  {nd.valeur}
                  <tspan className="sk-sec"> · {pct(nd.valeur)} %{nd.sous ? ` · ${nd.sous}` : ""}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {survol && (
        <div
          className="pointer-events-none fixed z-50 rounded bg-navy-900 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-md dark:bg-slate-100 dark:text-slate-900"
          style={{ left: Math.min(survol.x + 14, (typeof window !== "undefined" ? window.innerWidth : 0) - 280), top: survol.y - 36 }}
        >
          {survol.texte}
        </div>
      )}

      <p className="px-5 pb-4 pt-1 text-[11px] leading-relaxed text-slate-400">
        Photographie des statuts actuels mise en forme d&apos;entonnoir, et non
        historique des transitions. Les statuts très peu peuplés sont affichés
        avec une épaisseur minimale pour rester visibles ; le chiffre à côté du
        nœud fait foi. Cliquez un statut pour ouvrir la liste correspondante.
      </p>
    </div>
  );
}

function Onglet({
  children, actif, onClick, couleur,
}: { children: ReactNode; actif: boolean; onClick: () => void; couleur?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        actif
          ? "border-navy-900 bg-navy-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
      )}
    >
      {couleur && <span className="h-1.5 w-1.5 rounded-full" style={{ background: couleur }} />}
      {children}
    </button>
  );
}
