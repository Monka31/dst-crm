"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Copy, Download, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Select, Spinner, cx } from "@/components/ui";
import { CHANNELS, labelOf } from "@/lib/constants";
import { download, fmtDateTime, fullName, initials, toCsv } from "@/lib/format";
import {
  cleJour, faitsMarquants, libelleJour, libelleStatut, nomDepuisStatut, phrase, statutCible,
  type Evenement,
} from "@/lib/resume";

type Relance = { id: string; due_date: string; company: { name: string } | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const ajouter = (base: string, jours: number) => {
  const d = new Date(base + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + jours);
  return iso(d);
};
/** Lundi de la semaine contenant la date donnée. */
const lundi = (base: string) => {
  const d = new Date(base + "T12:00:00Z");
  return ajouter(base, -((d.getUTCDay() + 6) % 7));
};

export default function ResumePage() {
  const { canWrite, members, poles, settings, profile } = useApp();

  const [periode, setPeriode] = useState<"jour" | "semaine">("jour");
  const [ancre, setAncre] = useState(() => iso(new Date()));
  const [membre, setMembre] = useState("");
  const [pole, setPole] = useState("");

  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [relances, setRelances] = useState<Relance[]>([]);
  const [loading, setLoading] = useState(true);
  const [copie, setCopie] = useState(false);
  const [ouvert, setOuvert] = useState<Record<string, boolean>>({});

  const debut = periode === "jour" ? ancre : lundi(ancre);
  const fin = periode === "jour" ? ajouter(debut, 1) : ajouter(debut, 7);

  /**
   * Une seule requête sur la période affichée, et non sur tout le journal :
   * à 350 entreprises et douze personnes actives il comptera des milliers de
   * lignes, qu'aucun compte rendu n'a besoin de charger.
   */
  const load = useCallback(async () => {
    if (!canWrite) { setLoading(false); return; }
    const [a, r] = await Promise.all([
      supabase.from("activity_log")
        .select("id,actor_id,action,entity_type,label,company_id,created_at," +
                "actor:profiles(first_name,last_name), company:companies(name,pole_id)")
        .gte("created_at", `${debut}T00:00:00`)
        .lt("created_at", `${fin}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("follow_ups")
        .select("id,due_date, company:companies(name)")
        .eq("status", "a_faire")
        .lt("due_date", fin)
        .order("due_date"),
    ]);
    setEvenements((a.data as unknown as Evenement[]) ?? []);
    setRelances((r.data as unknown as Relance[]) ?? []);
    setLoading(false);
  }, [canWrite, debut, fin]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["activity_log"], load, "resume");

  const filtres = useMemo(() => evenements.filter((e) => {
    if (membre && e.actor_id !== membre) return false;
    if (pole && e.company?.pole_id !== pole) return false;
    return true;
  }), [evenements, membre, pole]);

  /** Regroupement en journées, puis en personnes à l'intérieur de chaque journée. */
  const journees = useMemo(() => {
    const parJour = new Map<string, Evenement[]>();
    filtres.forEach((e) => {
      const j = cleJour(e.created_at);
      parJour.set(j, [...(parJour.get(j) ?? []), e]);
    });
    return [...parJour.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([jour, liste]) => {
        const parPersonne = new Map<string, Evenement[]>();
        liste.forEach((e) => {
          const k = e.actor_id ?? "inconnu";
          parPersonne.set(k, [...(parPersonne.get(k) ?? []), e]);
        });
        const personnes = [...parPersonne.entries()]
          .map(([id, ev]) => ({
            id,
            nom: fullName(ev[0].actor) || "Compte supprimé",
            acteur: ev[0].actor ?? null,
            texte: phrase(ev),
            evenements: ev,
          }))
          .filter((p) => p.texte)
          .sort((a, b) => b.evenements.length - a.evenements.length);
        return { jour, liste, personnes, faits: faitsMarquants(liste) };
      });
  }, [filtres]);

  const actifs = useMemo(
    () => new Set(filtres.map((e) => e.actor_id).filter(Boolean) as string[]),
    [filtres]
  );
  const silencieux = members.filter(
    (m) => m.role !== "viewer" && !actifs.has(m.id)
  );

  const enRetard = relances.filter((r) => r.due_date < iso(new Date()));

  /** Le compte rendu en texte brut, à coller dans la conversation de la promo. */
  const texteCompteRendu = () => {
    const lignes: string[] = [];
    lignes.push(periode === "jour"
      ? `Compte rendu — ${libelleJour(debut)}`
      : `Compte rendu — semaine du ${libelleJour(debut)}`);
    lignes.push("");
    journees.forEach((j) => {
      if (periode === "semaine") lignes.push(`— ${libelleJour(j.jour)} —`);
      const f = j.faits;
      const marquants: string[] = [];
      if (f.positifs.length) marquants.push(`${f.positifs.length} réponse(s) positive(s) : ${f.positifs.join(", ")}`);
      if (f.visites.length) marquants.push(`${f.visites.length} visite(s) confirmée(s) : ${f.visites.join(", ")}`);
      if (f.refus.length) marquants.push(`${f.refus.length} refus : ${f.refus.join(", ")}`);
      if (marquants.length) { lignes.push(...marquants.map((m) => `• ${m}`)); lignes.push(""); }
      j.personnes.forEach((p) => lignes.push(`${p.nom} ${p.texte}`));
      lignes.push("");
    });
    if (enRetard.length) {
      lignes.push(`Relances en retard : ${enRetard.length}`);
      enRetard.slice(0, 10).forEach((r) =>
        lignes.push(`• ${r.company?.name ?? "—"} (prévue le ${r.due_date.split("-").reverse().join("/")})`));
    }
    if (journees.length === 0) lignes.push("Aucune activité enregistrée sur la période.");
    return lignes.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };

  const copier = async () => {
    try { await navigator.clipboard.writeText(texteCompteRendu()); } catch {}
    setCopie(true);
    window.setTimeout(() => setCopie(false), 2000);
  };

  const exporter = () => download(`compte-rendu-${debut}.csv`, toCsv(filtres.map((e) => ({
    Date: fmtDateTime(e.created_at),
    Membre: fullName(e.actor),
    Action: e.action.replace(/_/g, " "),
    Entreprise: e.company?.name ?? "",
    Détail: e.label ?? "",
  }))));

  if (!canWrite) {
    return (
      <Card>
        <EmptyState title="Réservé aux éditeurs"
          hint="Le compte rendu détaille l'activité de chaque membre. Il est accessible aux administrateurs, team leaders et membres." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Résumé</h1>
          <p className="text-sm text-slate-500">
            Ce qui s&apos;est passé, jour par jour — prêt à être recopié dans un compte rendu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Button size="sm" onClick={copier}>
            {copie ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier le compte rendu</>}
          </Button>
          <Button size="sm" variant="secondary" onClick={exporter}><Download size={14} /> CSV</Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer size={14} /> Imprimer</Button>
        </div>
      </div>

      <Card className="p-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded border border-slate-300 dark:border-slate-700">
            {(["jour", "semaine"] as const).map((p) => (
              <button key={p} onClick={() => setPeriode(p)}
                className={cx("px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  periode === p ? "bg-brand-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300")}>
                {p === "jour" ? "Par jour" : "Par semaine"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" aria-label="Période précédente"
              onClick={() => setAncre(ajouter(ancre, periode === "jour" ? -1 : -7))}>
              <ChevronLeft size={15} />
            </Button>
            <span className="min-w-[190px] text-center text-[13px] font-medium capitalize text-navy-900 dark:text-slate-100">
              {periode === "jour" ? libelleJour(debut) : `semaine du ${libelleJour(debut)}`}
            </span>
            <Button size="sm" variant="ghost" aria-label="Période suivante"
              disabled={fin > iso(new Date()) + "z"}
              onClick={() => setAncre(ajouter(ancre, periode === "jour" ? 1 : 7))}>
              <ChevronRight size={15} />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAncre(iso(new Date()))}>
              Aujourd&apos;hui
            </Button>
          </div>

          <Select value={membre} onChange={(e) => setMembre(e.target.value)} className="w-auto min-w-[170px]">
            <option value="">Tous les membres</option>
            {members.filter((m) => m.role !== "viewer").map((m) => (
              <option key={m.id} value={m.id}>{`${m.first_name} ${m.last_name}`.trim()}</option>
            ))}
          </Select>
          <Select value={pole} onChange={(e) => setPole(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Tous les pôles</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8"><Spinner /></Card>
      ) : journees.length === 0 ? (
        <Card>
          <EmptyState title="Aucune activité sur cette période"
            hint="Changez de jour ou passez en vue hebdomadaire." />
        </Card>
      ) : journees.map((j) => (
        <Card key={j.jour} className="card-print overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="font-serif text-[15px] font-semibold capitalize text-navy-900 dark:text-slate-100">
              {libelleJour(j.jour)}
            </h2>
            <span className="text-[11.5px] text-slate-400">
              {j.liste.length} événement{j.liste.length > 1 ? "s" : ""} · {j.personnes.length} membre{j.personnes.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Ce qui a bougé passe avant ce qui a été fait. */}
          {(j.faits.positifs.length > 0 || j.faits.visites.length > 0 || j.faits.refus.length > 0) && (
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
              {j.faits.positifs.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {j.faits.positifs.length} réponse{j.faits.positifs.length > 1 ? "s" : ""} positive{j.faits.positifs.length > 1 ? "s" : ""} · {j.faits.positifs.join(", ")}
                </Badge>
              )}
              {j.faits.visites.length > 0 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                  {j.faits.visites.length} visite{j.faits.visites.length > 1 ? "s" : ""} confirmée{j.faits.visites.length > 1 ? "s" : ""} · {j.faits.visites.join(", ")}
                </Badge>
              )}
              {j.faits.refus.length > 0 && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                  {j.faits.refus.length} refus · {j.faits.refus.join(", ")}
                </Badge>
              )}
            </div>
          )}

          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {j.personnes.map((p) => {
              const cle = `${j.jour}-${p.id}`;
              return (
                <li key={cle} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={initials(p.acteur)} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                        <b className="text-navy-900 dark:text-slate-100">{p.nom}</b> {p.texte}
                      </p>
                      <button
                        onClick={() => setOuvert((o) => ({ ...o, [cle]: !o[cle] }))}
                        className="mt-1 text-[11px] text-slate-400 hover:text-brand-700 no-print">
                        {ouvert[cle] ? "Masquer le détail" : `Voir le détail (${p.evenements.length})`}
                      </button>

                      {ouvert[cle] && (
                        <ul className="mt-2 space-y-1 border-l-2 border-slate-100 pl-3 dark:border-slate-800">
                          {p.evenements.map((e) => (
                            <li key={e.id} className="text-[11.5px] text-slate-500">
                              <span className="tabular text-slate-400">
                                {new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>{" "}
                              {detail(e)}
                              {e.company_id && e.company?.name && (
                                <Link href={`/entreprises/${e.company_id}`}
                                  className="ml-1 text-brand-700 hover:underline">{e.company.name}</Link>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {enRetard.length > 0 && (
        <Card className="card-print border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="card-title mb-2 text-amber-900 dark:text-amber-300">
            {enRetard.length} relance{enRetard.length > 1 ? "s" : ""} en retard
          </h2>
          <ul className="space-y-1 text-[12.5px] text-amber-800 dark:text-amber-400">
            {enRetard.slice(0, 12).map((r) => (
              <li key={r.id}>
                {r.company?.name ?? "—"} — prévue le {r.due_date.split("-").reverse().join("/")}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {settings?.show_inactivity && silencieux.length > 0 && (
        <Card className="p-4">
          <h2 className="card-title mb-2">Sans activité enregistrée sur la période</h2>
          <div className="flex flex-wrap gap-2">
            {silencieux.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 px-2 py-1 text-[12px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <Avatar name={initials(m)} size={18} />
                {`${m.first_name} ${m.last_name}`.trim()}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            L&apos;absence d&apos;enregistrement ne veut pas dire l&apos;absence de travail : un appel
            passé sans être noté ne laisse aucune trace ici.
          </p>
        </Card>
      )}

      <p className="text-[11px] text-slate-400 no-print">
        Connecté en tant que {fullName(profile)}. Le journal ne retient que ce qui a été
        enregistré dans l&apos;outil.
      </p>
    </div>
  );
}

/** Libellé lisible d'un événement dans le détail dépliable. */
function detail(e: Evenement): string {
  switch (e.action) {
    case "company_created": return `entreprise ajoutée :`;
    case "company_deleted": return `entreprise supprimée : ${e.label ?? ""}`;
    case "status_changed": return `${nomDepuisStatut(e.label)} → ${libelleStatut(statutCible(e.label))} —`;
    case "owner_changed": return `responsable modifié :`;
    case "contact_added": return `contact ajouté : ${e.label ?? ""} chez`;
    case "contact_deleted": return `contact supprimé : ${e.label ?? ""} chez`;
    case "contact_moved": return `contact déplacé : ${e.label ?? ""} vers`;
    case "contact_status_changed": return `statut d'interlocuteur : ${e.label ?? ""} chez`;
    case "contact_note_added": return `note sur ${e.label ?? "un contact"} chez`;
    case "interaction_added": return `${labelOf(CHANNELS, e.label)} —`;
    case "followup_created": return `relance programmée : ${e.label ?? ""}`;
    case "followup_done": return `relance clôturée :`;
    case "followup_cancelled": return `relance annulée :`;
    case "followup_deleted": return `relance supprimée :`;
    case "task_created": return `tâche créée : ${e.label ?? ""}`;
    case "task_done": return `tâche terminée : ${e.label ?? ""}`;
    case "task_deleted": return `tâche supprimée : ${e.label ?? ""}`;
    case "visit_created": return `visite créée chez`;
    case "visit_updated": return `visite modifiée chez`;
    case "visit_deleted": return `visite supprimée chez`;
    case "note_added": return `note ajoutée sur`;
    default: return `${e.action.replace(/_/g, " ")} —`;
  }
}
