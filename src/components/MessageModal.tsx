"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";
import { Button, Modal, Select, Spinner, cx } from "@/components/ui";
import { templateChannelLabel } from "@/lib/constants";
import { apercuHtml, nettoyerHtml, remplacerVariables, versTexte } from "@/lib/modeles";
import { PiecesJointes } from "@/components/PiecesJointes";
import { fmtDate } from "@/lib/format";
import type { MessageTemplate } from "@/lib/types";

/**
 * Rédaction d'un message sans quitter la fiche.
 *
 * L'onglet Interactions faisait déjà ce travail, mais il fallait sortir de la
 * fiche du contact pour y aller, puis y revenir pour enregistrer l'échange.
 * Trois pages pour un copier-coller. Ici le modèle s'ouvre par-dessus, on
 * copie, on ferme, et on est resté au même endroit pour consigner l'envoi.
 *
 * Le composant ne lit que les modèles : l'entreprise et l'interlocuteur lui
 * sont donnés par la fiche appelante, donc aucune liste déroulante à
 * reparcourir.
 */
export function MessageModal({
  open, onClose, contact, entreprise,
}: {
  open: boolean;
  onClose: () => void;
  contact: { id: string; first_name: string; last_name: string; position: string | null } | null;
  entreprise: { id: string; name: string; city: string | null; sector: string | null; last_interaction_at: string | null } | null;
}) {
  const { profile, settings } = useApp();
  const [modeles, setModeles] = useState<MessageTemplate[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [copie, setCopie] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data } = await supabase.from("message_templates")
      .select("*").order("position").order("title");
    const liste = (data as MessageTemplate[]) ?? [];
    setModeles(liste);
    setSelId((prec) => (prec && liste.some((m) => m.id === prec) ? prec : liste[0]?.id ?? null));
    setChargement(false);
  }, []);

  // Les modèles ne sont chargés qu'à la première ouverture : les récupérer au
  // montage de chaque fiche ferait une requête pour rien sur chaque contact.
  useEffect(() => { if (open) charger(); }, [open, charger]);

  const datesVoyage = useMemo(() => {
    const d = settings?.trip_start_date, f = settings?.trip_end_date;
    return d && f ? `${fmtDate(d)} au ${fmtDate(f)}` : "";
  }, [settings]);

  const valeurs = useMemo<Record<string, string>>(() => ({
    prenom: contact?.first_name ?? "",
    nom: contact?.last_name ?? "",
    poste: contact?.position ?? "",
    entreprise: entreprise?.name ?? "",
    ville: entreprise?.city ?? "",
    secteur: entreprise?.sector ?? "",
    mon_prenom: profile?.first_name ?? "",
    mon_nom: profile?.last_name ?? "",
    ville_voyage: settings?.trip_city ?? "",
    dates_voyage: datesVoyage,
    date_dernier_contact: entreprise?.last_interaction_at ? fmtDate(entreprise.last_interaction_at) : "",
  }), [contact, entreprise, profile, settings, datesVoyage]);

  const modele = modeles.find((m) => m.id === selId) ?? null;

  const marquerCopie = (repere: string) => {
    setCopie(repere);
    window.setTimeout(() => setCopie(null), 2000);
  };

  /**
   * Deux formats dans le presse-papier : le texte brut pour LinkedIn, le HTML
   * pour Gmail, qui garde alors le gras. Le surlignage des variables n'existe
   * qu'à l'écran et ne part jamais à la copie.
   */
  const copierMessage = async (html: string) => {
    const resolu = remplacerVariables(nettoyerHtml(html), valeurs);
    const texte = versTexte(resolu);
    try {
      if (navigator.clipboard && typeof window !== "undefined" && "ClipboardItem" in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([texte], { type: "text/plain" }),
            "text/html": new Blob([resolu], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(texte);
      }
    } catch {
      const zone = document.createElement("textarea");
      zone.value = texte;
      document.body.appendChild(zone);
      zone.select();
      try { document.execCommand("copy"); } catch {}
      zone.remove();
    }
    marquerCopie("corps");
  };

  const copierTexte = async (texte: string, repere: string) => {
    try { await navigator.clipboard.writeText(texte); } catch {}
    marquerCopie(repere);
  };

  const destinataire = contact ? `${contact.first_name} ${contact.last_name}` : "—";

  return (
    <Modal open={open} onClose={onClose} wide
      title={`Écrire à ${destinataire}`}>
      {chargement ? (
        <div className="py-10 text-center"><Spinner className="h-5 w-5" /></div>
      ) : modeles.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          Aucun modèle de message n&apos;a encore été rédigé.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-[12.5px] text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{destinataire}</span>
              {contact?.position ? ` · ${contact.position}` : ""}
              {entreprise ? ` · ${entreprise.name}` : ""}
            </p>
            <a href="/interactions" className="inline-flex items-center gap-1 text-[11.5px] text-brand-600 hover:underline">
              Gérer les modèles <ExternalLink size={11} />
            </a>
          </div>

          <Select value={selId ?? ""} onChange={(e) => setSelId(e.target.value)}>
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>{m.title} · {templateChannelLabel(m.channel)}</option>
            ))}
          </Select>

          {modele && (
            <>
              {modele.subject && (
                <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="label mb-1">Objet</p>
                      <p className="break-words text-sm text-slate-800 dark:text-slate-200"
                        dangerouslySetInnerHTML={{ __html: apercuHtml(modele.subject, valeurs) }} />
                    </div>
                    <Button size="sm" variant="secondary"
                      onClick={() => copierTexte(versTexte(remplacerVariables(modele.subject ?? "", valeurs)), "objet")}>
                      {copie === "objet" ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="label">Message</p>
                  <Button size="sm" onClick={() => copierMessage(modele.body_html)}>
                    {copie === "corps" ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier le message</>}
                  </Button>
                </div>
                <div
                  className={cx(
                    "max-h-[45vh] overflow-y-auto rounded border border-slate-200 bg-white p-3.5",
                    "text-[13.5px] leading-relaxed text-slate-800",
                    "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  )}
                  dangerouslySetInnerHTML={{ __html: apercuHtml(nettoyerHtml(modele.body_html), valeurs) }}
                />
                <p className="mt-2 text-[11px] leading-snug text-slate-400">
                  En <span className="rounded-sm bg-brand-50 px-1 text-brand-900 dark:bg-brand-950/60 dark:text-brand-200">bleu</span> les
                  valeurs reprises de la fiche, en <span className="rounded-sm bg-amber-100 px-1 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">orange</span> ce
                  qui reste à compléter. Le surlignage ne part pas dans le presse-papier.
                </p>
              </div>

              {/* Les pièces jointes sont ici parce que presque tous les
                  modèles annoncent le flyer du voyage : sans elles, il
                  faudrait quand même passer par l'onglet Interactions pour
                  aller le chercher, et la fenêtre n'aurait rien réglé. */}
              <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
                <PiecesJointes templateId={modele.id} />
              </div>

              <p className="text-[11.5px] text-slate-400">
                Une fois le message envoyé, fermez cette fenêtre et enregistrez
                l&apos;échange avec le bouton « Interaction ».
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
