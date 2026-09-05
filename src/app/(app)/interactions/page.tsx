"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Plus, Trash2, Pencil, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Spinner, cx } from "@/components/ui";
import { EditeurTexte } from "@/components/EditeurTexte";
import { PiecesJointes } from "@/components/PiecesJointes";
import { TEMPLATE_CHANNELS, templateChannelLabel } from "@/lib/constants";
import { apercuHtml, nettoyerHtml, remplacerVariables, surlignerVariables, versTexte, VARIABLES } from "@/lib/modeles";
import { fmtDate } from "@/lib/format";
import type { MessageTemplate } from "@/lib/types";

type Entreprise = {
  id: string; name: string; city: string | null; sector: string | null; last_interaction_at: string | null;
};
type Interlocuteur = {
  id: string; first_name: string; last_name: string; position: string | null; company_id: string;
};

const VIDE = { title: "", channel: "email", subject: "", body_html: "", position: 99 };

export default function InteractionsPage() {
  const { isAdmin, profile, settings } = useApp();

  const [modeles, setModeles] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);

  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [interlocuteurs, setInterlocuteurs] = useState<Interlocuteur[]>([]);
  const [entrepriseId, setEntrepriseId] = useState("");
  const [contactId, setContactId] = useState("");

  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState<typeof VIDE & { id?: string }>(VIDE);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, e, c] = await Promise.all([
      supabase.from("message_templates").select("*").order("position").order("title"),
      supabase.from("companies").select("id,name,city,sector,last_interaction_at").order("name"),
      supabase.from("contacts").select("id,first_name,last_name,position,company_id").order("last_name"),
    ]);
    const liste = (t.data as MessageTemplate[]) ?? [];
    setModeles(liste);
    setEntreprises((e.data as Entreprise[]) ?? []);
    setInterlocuteurs((c.data as Interlocuteur[]) ?? []);
    setSelId((prec) => (prec && liste.some((m) => m.id === prec) ? prec : liste[0]?.id ?? null));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(["message_templates"], load, "modeles");

  const modele = modeles.find((m) => m.id === selId) ?? null;

  // Changer d'entreprise remet le contact à zéro : garder un interlocuteur
  // d'une autre société produirait un message incohérent.
  const contactsDeLEntreprise = interlocuteurs.filter((c) => c.company_id === entrepriseId);
  useEffect(() => { setContactId(""); }, [entrepriseId]);

  const datesVoyage = useMemo(() => {
    const d = settings?.trip_start_date, f = settings?.trip_end_date;
    if (!d || !f) return "";
    return `${fmtDate(d)} au ${fmtDate(f)}`;
  }, [settings]);

  const valeurs = useMemo<Record<string, string>>(() => {
    const ent = entreprises.find((x) => x.id === entrepriseId);
    const ct = contactsDeLEntreprise.find((x) => x.id === contactId);
    return {
      prenom: ct?.first_name ?? "",
      nom: ct?.last_name ?? "",
      poste: ct?.position ?? "",
      entreprise: ent?.name ?? "",
      ville: ent?.city ?? "",
      secteur: ent?.sector ?? "",
      mon_prenom: profile?.first_name ?? "",
      mon_nom: profile?.last_name ?? "",
      ville_voyage: settings?.trip_city ?? "",
      dates_voyage: datesVoyage,
      date_dernier_contact: ent?.last_interaction_at ? fmtDate(ent.last_interaction_at) : "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprises, interlocuteurs, entrepriseId, contactId, profile, settings, datesVoyage]);

  /**
   * Le presse-papier reçoit deux versions du même message : le texte brut et
   * la version mise en forme. LinkedIn récupère ainsi un texte propre, et
   * Gmail conserve les passages en gras — sans jamais coller le surlignage
   * des variables, qui n'existe que pour la lecture à l'écran.
   */
  const copier = async (html: string, repere: string) => {
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
    setCopie(repere);
    window.setTimeout(() => setCopie(null), 2000);
  };

  const copierTexte = async (texte: string, repere: string) => {
    try { await navigator.clipboard.writeText(texte); } catch {}
    setCopie(repere);
    window.setTimeout(() => setCopie(null), 2000);
  };

  const nouveau = () => { setBrouillon({ ...VIDE, position: modeles.length + 1 }); setEdition(true); setErreur(null); };
  const modifier = () => {
    if (!modele) return;
    setBrouillon({
      id: modele.id, title: modele.title, channel: modele.channel,
      subject: modele.subject ?? "", body_html: modele.body_html, position: modele.position,
    });
    setEdition(true); setErreur(null);
  };

  const enregistrer = async () => {
    if (!brouillon.title.trim()) { setErreur("Donnez un titre au modèle."); return; }
    setBusy(true); setErreur(null);
    const charge = {
      title: brouillon.title.trim(),
      channel: brouillon.channel,
      subject: brouillon.subject?.trim() || null,
      body_html: brouillon.body_html,
      position: Number(brouillon.position) || 99,
    };
    const { data, error } = brouillon.id
      ? await supabase.from("message_templates").update(charge).eq("id", brouillon.id).select("id").maybeSingle()
      : await supabase.from("message_templates").insert({ ...charge, created_by: profile?.id ?? null }).select("id").maybeSingle();
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setEdition(false);
    if (data?.id) setSelId(data.id);
    load();
  };

  const supprimer = async () => {
    if (!modele) return;
    if (!window.confirm(`Supprimer définitivement le modèle « ${modele.title} » ?`)) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", modele.id);
    if (error) { setErreur(error.message); return; }
    setSelId(null); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Interactions</h1>
          <p className="text-sm text-slate-500">
            Modèles de messages prêts à l&apos;emploi. Choisissez une entreprise et un interlocuteur,
            le message se complète tout seul.
          </p>
        </div>
        {isAdmin && !edition && (
          <Button size="sm" onClick={nouveau}><Plus size={14} /> Nouveau modèle</Button>
        )}
      </div>

      {!isAdmin && (
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Les modèles sont rédigés par les administrateurs. Vous pouvez les utiliser et les copier,
          mais pas les modifier — pour que tout le monde envoie le même message.
        </p>
      )}

      {loading ? (
        <Card className="p-8"><Spinner /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="overflow-hidden">
            <p className="border-b border-slate-200 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800">
              {modeles.length} modèle{modeles.length > 1 ? "s" : ""}
            </p>
            {modeles.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">Aucun modèle pour l&apos;instant.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {modeles.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => { setSelId(m.id); setEdition(false); }}
                      className={cx(
                        "w-full px-3 py-2.5 text-left transition-colors",
                        m.id === selId && !edition
                          ? "bg-brand-50 dark:bg-brand-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <span className="block truncate text-[13px] font-medium text-navy-900 dark:text-slate-100">{m.title}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{templateChannelLabel(m.channel)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {edition ? (
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="card-title">{brouillon.id ? "Modifier le modèle" : "Nouveau modèle"}</h2>
                <Button size="sm" variant="ghost" onClick={() => setEdition(false)}><X size={14} /> Annuler</Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="Titre">
                    <Input value={brouillon.title} onChange={(e) => setBrouillon({ ...brouillon, title: e.target.value })}
                      placeholder="Premier contact — email" />
                  </Field>
                </div>
                <Field label="Canal">
                  <Select value={brouillon.channel} onChange={(e) => setBrouillon({ ...brouillon, channel: e.target.value })}>
                    {TEMPLATE_CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </Select>
                </Field>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-3">
                  <Field label="Objet" hint="Pour les emails uniquement. Les variables fonctionnent aussi ici.">
                    <Input value={brouillon.subject ?? ""} onChange={(e) => setBrouillon({ ...brouillon, subject: e.target.value })}
                      placeholder="Digital Study Trip ESSEC — {{entreprise}}" />
                  </Field>
                </div>
                <Field label="Ordre">
                  <Input type="number" value={brouillon.position}
                    onChange={(e) => setBrouillon({ ...brouillon, position: Number(e.target.value) })} />
                </Field>
              </div>

              <div className="mt-3">
                <span className="label mb-1.5 block">Message</span>
                <EditeurTexte
                  cle={brouillon.id ?? "nouveau"}
                  valeurInitiale={brouillon.body_html}
                  onChange={(html) => setBrouillon((b) => ({ ...b, body_html: html }))}
                />
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                  Mettez en gras ou en couleur ce qui doit attirer l&apos;œil. Les parties variables
                  s&apos;écrivent entre doubles accolades et sont surlignées automatiquement à la lecture :
                  utilisez le menu « Insérer une variable ».
                </p>
              </div>

              <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="label mb-1.5">Variables disponibles</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <Badge key={v.cle} className="bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                      {`{{${v.cle}}}`} · {v.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {erreur && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{erreur}</p>}

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEdition(false)}>Annuler</Button>
                <Button onClick={enregistrer} disabled={busy}>{busy ? <Spinner /> : "Enregistrer"}</Button>
              </div>
            </Card>
          ) : !modele ? (
            <Card>
              <EmptyState
                title="Aucun modèle sélectionné"
                hint={isAdmin ? "Créez un premier modèle de message pour l'équipe." : "Aucun modèle n'a encore été rédigé."}
                action={isAdmin ? <Button size="sm" className="mt-3" onClick={nouveau}><Plus size={14} /> Nouveau modèle</Button> : undefined}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="card-title">{modele.title}</h2>
                    <p className="mt-0.5 text-[11.5px] text-slate-500">{templateChannelLabel(modele.channel)}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={modifier}><Pencil size={13} /> Modifier</Button>
                      <Button size="sm" variant="danger" onClick={supprimer}><Trash2 size={13} /> Supprimer</Button>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Entreprise">
                    <Select value={entrepriseId} onChange={(e) => setEntrepriseId(e.target.value)}>
                      <option value="">— Choisir une entreprise —</option>
                      {entreprises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Interlocuteur"
                    hint={entrepriseId && contactsDeLEntreprise.length === 0 ? "Aucun contact enregistré pour cette entreprise." : undefined}>
                    <Select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!entrepriseId}>
                      <option value="">— Choisir un interlocuteur —</option>
                      {contactsDeLEntreprise.map((c) => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.position ? ` · ${c.position}` : ""}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </Card>

              {modele.subject && (
                <Card className="p-4">
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
                </Card>
              )}

              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="label">Message</p>
                  <Button size="sm" onClick={() => copier(modele.body_html, "corps")}>
                    {copie === "corps" ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier le message</>}
                  </Button>
                </div>
                <div
                  className="rounded border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: apercuHtml(nettoyerHtml(modele.body_html), valeurs) }}
                />
                <p className="mt-2 text-[11px] leading-snug text-slate-400">
                  En <span className="rounded-sm bg-brand-50 px-1 text-brand-900 dark:bg-brand-950/60 dark:text-brand-200">bleu</span> les
                  valeurs reprises de la fiche, en <span className="rounded-sm bg-amber-100 px-1 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">orange</span> ce
                  qui reste à compléter. Le surlignage ne part pas dans le presse-papier.
                </p>
              </Card>

              <Card className="p-4">
                <PiecesJointes templateId={modele.id} />
              </Card>

              <Card className="p-4">
                <p className="label mb-2">Modèle d&apos;origine</p>
                <div
                  className="rounded border border-dashed border-slate-200 p-3 text-[13px] leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400"
                  dangerouslySetInnerHTML={{ __html: surlignerVariables(nettoyerHtml(modele.body_html)) }}
                />
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
