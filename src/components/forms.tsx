"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";
import { Button, Field, Input, Modal, ModalActions, Select, Textarea, Badge, Spinner, cx } from "@/components/ui";
import { CHANNELS, CONTACT_STATUSES, DIRECTIONS, EMAIL_STATUSES, OUTCOMES, PRIORITIES, RELATION_TYPES, SOURCES, STATUSES, directionMeta, labelOf, statusMeta } from "@/lib/constants";
import { addDays, fmtDateShort, fullName, relative, today } from "@/lib/format";
import type { Company, Contact, Duplicate, Interaction, Task } from "@/lib/types";

/** Valeur sentinelle du sélecteur « Assignée à » pour une tâche collective. */
const EQUIPE = "__equipe__";

/** Contact déjà présent qui ressemble à celui en cours de saisie. */
type Doublon = {
  id: string; first_name: string; last_name: string; email: string | null;
  company?: { name: string } | null;
};

const SECTORS = [
  "Luxe & Beauté", "Grande Consommation", "Industrie de Santé", "Tech & Digital",
  "Finance", "Conseil", "Média & Publicité", "Retail & Distribution",
  "Mode", "Agroalimentaire", "Transport & Mobilité", "Énergie", "Autre",
];

/* ------------------------------------------------------------------ */
/*  ENTREPRISE                                                         */
/* ------------------------------------------------------------------ */

export function CompanyModal({
  open, onClose, onSaved, company,
}: { open: boolean; onClose: () => void; onSaved: (id: string) => void; company?: Company | null }) {
  const { poles, profile, settings, editeurs } = useApp();
  const editing = !!company;

  const blank = useMemo(() => ({
    name: "", website: "", sector: "", subsector: "", description: "", employee_count: "", revenue: "",
    country: settings?.trip_country ?? "Royaume-Uni", city: settings?.trip_city ?? "Londres",
    address: "", linkedin_url: "",
    pole_id: profile?.pole_id ?? "", owner_id: profile?.id ?? "",
    priority: "moyenne", source: "linkedin", status: "a_identifier",
    refusal_reason: "",
    logo_url: "",
  }), [profile, settings]);

  const [f, setF] = useState<Record<string, string>>(blank);
  const [retryNextYear, setRetryNextYear] = useState(false);
  const [dupes, setDupes] = useState<Duplicate[]>([]);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null); setDupes([]);
    setRetryNextYear(company?.retry_next_year ?? false);
    if (company) {
      setF({
        name: company.name ?? "", website: company.website ?? "", sector: company.sector ?? "",
        subsector: company.subsector ?? "", description: company.description ?? "",
        employee_count: company.employee_count ?? "", revenue: company.revenue ?? "",
        country: company.country ?? "",
        city: company.city ?? "", address: company.address ?? "",
        linkedin_url: company.linkedin_url ?? "", pole_id: company.pole_id ?? "",
        owner_id: company.owner_id ?? "", priority: company.priority ?? "moyenne",
        source: company.source ?? "", status: company.status ?? "a_identifier",
        refusal_reason: company.refusal_reason ?? "",
        logo_url: company.logo_url ?? "",
      });
    } else setF(blank);
  }, [open, company, blank]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const uploadLogo = async (file: File) => {
    if (file.size > 2_000_000) { setError("Logo trop lourd : 2 Mo maximum."); return; }
    setUploading(true); setError(null);
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); setError("Envoi impossible : " + upErr.message); return; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    setF((p) => ({ ...p, logo_url: data.publicUrl }));
    setUploading(false);
  };

  const checkDuplicates = async () => {
    if (editing || f.name.trim().length < 2) return;
    setChecking(true);
    const { data } = await supabase.rpc("find_duplicates", {
      p_name: f.name.trim(), p_website: f.website.trim() || null,
    });
    setChecking(false);
    setDupes((data as Duplicate[]) ?? []);
  };

  const save = async () => {
    setBusy(true); setError(null);
    const payload = {
      name: f.name.trim(),
      website: f.website.trim() || null,
      sector: f.sector || null,
      subsector: f.subsector || null,
      description: f.description || null,
      employee_count: f.employee_count || null,
      revenue: f.revenue || null,
      country: f.country || null,
      city: f.city || null,
      address: f.address || null,
      linkedin_url: f.linkedin_url || null,
      pole_id: f.pole_id || null,
      owner_id: f.owner_id || null,
      priority: f.priority,
      source: f.source || null,
      status: f.status,
      logo_url: f.logo_url || null,
      refusal_reason: f.refusal_reason?.trim() || null,
      retry_next_year: retryNextYear,
    };
    const res = editing
      ? await supabase.from("companies").update(payload).eq("id", company!.id).select("id").single()
      : await supabase.from("companies").insert({ ...payload, created_by: profile?.id }).select("id").single();
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    onSaved(res.data.id as string);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Modifier l'entreprise" : "Ajouter une entreprise"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de l'entreprise *">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} onBlur={checkDuplicates}
              placeholder="Spotify" />
          </Field>
          <Field label="Site internet">
            <Input value={f.website} onChange={(e) => set("website", e.target.value)} onBlur={checkDuplicates}
              placeholder="spotify.com" />
          </Field>
        </div>

        {checking && <p className="flex items-center gap-2 text-xs text-slate-400"><Spinner /> Vérification des doublons…</p>}

        {dupes.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle size={16} /> Cette entreprise est peut-être déjà dans le CRM
            </p>
            <ul className="mt-2 space-y-2">
              {dupes.map((d) => (
                <li key={d.id} className="rounded-lg bg-white p-2.5 text-xs dark:bg-slate-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/entreprises/${d.id}`} onClick={onClose}
                      className="font-semibold text-slate-900 hover:underline dark:text-slate-100">{d.name}</Link>
                    <Badge className={statusMeta(d.status).chip}>{statusMeta(d.status).label}</Badge>
                    <span className="text-slate-400">
                      {d.match_reason === "site_identique" ? "site identique"
                        : d.match_reason === "nom_identique" ? "nom identique"
                        : `nom similaire (${Math.round(d.similarity * 100)} %)`}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    Responsable : <b>{d.owner_name || "aucun"}</b> · Dernière interaction : {relative(d.last_interaction_at)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              Contactez le·la responsable avant d&apos;aller plus loin, ou fermez ce formulaire.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Secteur">
            <Select value={f.sector} onChange={(e) => set("sector", e.target.value)}>
              <option value="">—</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Sous-secteur">
            <Input value={f.subsector} onChange={(e) => set("subsector", e.target.value)} />
          </Field>
          <Field label="Ville">
            <Input value={f.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Pays">
            <Input value={f.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label="Adresse">
            <Input value={f.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Effectif" hint="Une fourchette vieillit mieux qu'un chiffre exact.">
            <Input value={f.employee_count} onChange={(e) => set("employee_count", e.target.value)}
              placeholder="1 000 – 5 000" />
          </Field>
          <Field label="Chiffre d'affaires" hint="Ordre de grandeur, pour situer l'entreprise.">
            <Input value={f.revenue} onChange={(e) => set("revenue", e.target.value)}
              placeholder="1 – 5 Md€" />
          </Field>
          <Field label="LinkedIn entreprise">
            <Input value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
          </Field>
          <Field label="Source de découverte">
            <Select value={f.source} onChange={(e) => set("source", e.target.value)}>
              <option value="">—</option>
              {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Logo" hint="Facultatif : sans fichier, le logo est cherché automatiquement à partir du site internet. PNG, JPG ou SVG, 2 Mo maximum.">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
              {f.logo_url
                ? <img src={f.logo_url} alt="" className="h-full w-full object-contain" />
                : <ImageIcon size={18} className="text-slate-300" />}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {uploading ? <Spinner /> : <Upload size={13} />}
                {uploading ? "Envoi…" : "Choisir un fichier"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadLogo(file); e.target.value = ""; }} />
              </label>
              {f.logo_url && (
                <Button size="sm" variant="ghost" type="button" onClick={() => set("logo_url", "")}>
                  Retirer
                </Button>
              )}
            </div>
          </div>
        </Field>

        <Field label="Description">
          <Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Pôle / Track">
            <Select value={f.pole_id} onChange={(e) => set("pole_id", e.target.value)}>
              <option value="">—</option>
              {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={f.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">Non attribuée</option>
              {editeurs.map((m) => (
                <option key={m.id} value={m.id}>{fullName(m)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priorité">
            <Select value={f.priority} onChange={(e) => set("priority", e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
        </div>

        {/* Un refus vaut d'être expliqué : c'est ce qui évite qu'un camarade
            reparte à zéro, et ce que la promo suivante lira. */}
        {(f.status === "refus" || f.status === "abandonne") && (
          <div className="rounded border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30">
            <Field label="Motif du refus"
              hint="« Politique groupe : pas de visites étudiantes », « trop tard pour novembre », « mauvais interlocuteur »…">
              <Textarea rows={2} value={f.refusal_reason ?? ""} onChange={(e) => set("refusal_reason", e.target.value)} />
            </Field>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={retryNextYear} onChange={(e) => setRetryNextYear(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-500" />
              À retenter l&apos;an prochain
            </label>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy || !f.name.trim()}>
            {busy ? <Spinner /> : editing ? "Enregistrer" : "Ajouter l'entreprise"}
          </Button>
        </ModalActions>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  CONTACT                                                            */
/* ------------------------------------------------------------------ */

export function ContactModal({
  open, onClose, onSaved, companyId, contact, companies,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  companyId?: string; contact?: Contact | null; companies?: { id: string; name: string }[];
}) {
  const { profile, isStaff, settings, editeurs } = useApp();
  const [f, setF] = useState<Record<string, string>>({});
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [doublons, setDoublons] = useState<Doublon[]>([]);
  /** Ville du siège, proposée en un clic : la plupart des contacts y travaillent. */
  const [villeEntreprise, setVilleEntreprise] = useState<{ city: string; country: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIsPrimary(contact?.is_primary ?? false);
    setConfirmDelete(false);
    setF({
      company_id: contact?.company_id ?? companyId ?? "",
      first_name: contact?.first_name ?? "", last_name: contact?.last_name ?? "",
      position: contact?.position ?? "", department: contact?.department ?? "",
      email: contact?.email ?? "", phone: contact?.phone ?? "",
      linkedin_url: contact?.linkedin_url ?? "", relation_type: contact?.relation_type ?? "",
      relevance: String(contact?.relevance ?? 2),
      city: contact?.city ?? "",
      country: contact?.country ?? "",
      status: contact?.status ?? "a_contacter",
      email_status: contact?.email_status ?? "inconnu",
      referred_by: contact?.referred_by ?? "",
      referred_by_name: contact?.referred_by_name ?? "",
    });
  }, [open, contact, companyId]);

  /**
   * Doublon probable : la même adresse email, ou le même nom complet, déjà
   * enregistré ailleurs. On avertit sans bloquer — deux homonymes existent.
   */
  useEffect(() => {
    const email = (f.email ?? "").trim().toLowerCase();
    const nom = `${(f.first_name ?? "").trim()} ${(f.last_name ?? "").trim()}`.trim().toLowerCase();
    if (!open || (!email && nom.length < 4)) { setDoublons([]); return; }
    let vivant = true;
    const t = window.setTimeout(async () => {
      let req = supabase.from("contacts").select("id,first_name,last_name,email,company:companies(name)").limit(4);
      req = email
        ? req.ilike("email", email)
        : req.ilike("first_name", (f.first_name ?? "").trim()).ilike("last_name", (f.last_name ?? "").trim());
      const { data } = await req;
      if (!vivant) return;
      setDoublons(((data as unknown as Doublon[]) ?? []).filter((d) => d.id !== contact?.id));
    }, 400);
    return () => { vivant = false; window.clearTimeout(t); };
  }, [open, f.email, f.first_name, f.last_name, contact?.id]);

  useEffect(() => {
    const cid = f.company_id;
    if (!open || !cid) { setVilleEntreprise(null); return; }
    let vivant = true;
    supabase.from("companies").select("city,country").eq("id", cid).maybeSingle()
      .then(({ data }) => {
        if (!vivant) return;
        const d = data as { city: string | null; country: string | null } | null;
        setVilleEntreprise(d?.city || d?.country ? { city: d.city ?? "", country: d.country ?? "" } : null);
      });
    return () => { vivant = false; };
  }, [open, f.company_id]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const remove = async () => {
    if (!contact) return;
    setBusy(true); setError(null);
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("policy")
          ? "Vous ne pouvez supprimer que les contacts que vous avez créés. Demandez à un Team Leader ou à un administrateur."
          : error.message
      );
      return;
    }
    onSaved(); onClose();
  };

  const save = async () => {
    setBusy(true); setError(null);
    const payload = {
      company_id: f.company_id,
      first_name: f.first_name.trim(), last_name: f.last_name.trim(),
      position: f.position || null, department: f.department || null,
      email: f.email || null, phone: f.phone || null,
      linkedin_url: f.linkedin_url || null,
      relation_type: f.relation_type || null,
      relevance: Number(f.relevance), is_primary: isPrimary,
      city: f.city?.trim() || null,
      country: f.country?.trim() || null,
      status: f.status || null,
      email_status: f.email_status || "inconnu",
      referred_by: f.referred_by || null,
      referred_by_name: f.referred_by_name?.trim() || null,
    };
    const res = contact
      ? await supabase.from("contacts").update(payload).eq("id", contact.id)
      : await supabase.from("contacts").insert({ ...payload, created_by: profile?.id });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    onSaved(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={contact ? "Modifier le contact" : "Ajouter un contact"}>
      <div className="space-y-3">
        {(companies?.length ?? 0) > 0 ? (
          <Field label="Entreprise *"
            hint={contact ? "Changer d'entreprise déplace le contact et tout son historique." : undefined}>
            <Select value={f.company_id ?? ""} onChange={(e) => set("company_id", e.target.value)}>
              <option value="">— Choisir —</option>
              {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><Input value={f.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></Field>
          <Field label="Nom"><Input value={f.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Poste"><Input value={f.position ?? ""} onChange={(e) => set("position", e.target.value)} /></Field>
          <Field label="Département"><Input value={f.department ?? ""} onChange={(e) => set("department", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Téléphone"><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <Field label="LinkedIn"><Input value={f.linkedin_url ?? ""} onChange={(e) => set("linkedin_url", e.target.value)} /></Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ville où il travaille"
            hint="Peut différer du siège : un directeur France ne recevra pas à Amsterdam.">
            <Input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)}
              placeholder={settings?.trip_city ?? "Amsterdam"} list="villes-contacts" />
          </Field>
          <Field label="Pays">
            <Input value={f.country ?? ""} onChange={(e) => set("country", e.target.value)}
              placeholder="Pays-Bas" list="pays-contacts" />
          </Field>
        </div>
        {villeEntreprise && !f.city && (
          <button type="button"
            onClick={() => { set("city", villeEntreprise.city); set("country", villeEntreprise.country); }}
            className="-mt-1 self-start text-[11.5px] text-brand-700 hover:underline">
            Reprendre la localisation de l&apos;entreprise
            {` (${[villeEntreprise.city, villeEntreprise.country].filter(Boolean).join(", ")})`}
          </button>
        )}

        <datalist id="villes-contacts">
          {["Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Paris", "Londres", "Bruxelles"]
            .map((v) => <option key={v} value={v} />)}
        </datalist>
        <datalist id="pays-contacts">
          {["Pays-Bas", "France", "Belgique", "Allemagne", "Royaume-Uni", "Suisse", "États-Unis"]
            .map((v) => <option key={v} value={v} />)}
        </datalist>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fiabilité de l'email"
            hint="Une adresse reconstituée en prénom.nom explique un silence autrement.">
            <Select value={f.email_status ?? "inconnu"} onChange={(e) => set("email_status", e.target.value)}>
              {EMAIL_STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </Select>
          </Field>
          <Field label="Statut de l'interlocuteur">
            <Select value={f.status ?? "a_contacter"} onChange={(e) => set("status", e.target.value)}>
              {CONTACT_STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Présenté par" hint="Le membre de la promo qui a fourni ce contact.">
            <Select value={f.referred_by ?? ""} onChange={(e) => set("referred_by", e.target.value)}>
              <option value="">—</option>
              {editeurs.map((m) => (
                <option key={m.id} value={m.id}>{`${m.first_name} ${m.last_name}`.trim()}</option>
              ))}
            </Select>
          </Field>
          <Field label="…ou par une personne extérieure" hint="Un professeur, un alumni, une connaissance.">
            <Input value={f.referred_by_name ?? ""} onChange={(e) => set("referred_by_name", e.target.value)}
              placeholder="Nom de la personne" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type de relation">
            <Select value={f.relation_type ?? ""} onChange={(e) => set("relation_type", e.target.value)}>
              <option value="">—</option>
              {RELATION_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="Pertinence">
            <Select value={f.relevance ?? "2"} onChange={(e) => set("relevance", e.target.value)}>
              <option value="1">Faible</option><option value="2">Moyenne</option><option value="3">Élevée</option>
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-brand-500" />
          Contact prioritaire (affiché en tête de fiche)
        </label>

        {doublons.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
              Doublon possible : cette personne semble déjà enregistrée.
            </p>
            <ul className="mt-1 space-y-0.5 text-[11.5px] text-amber-800 dark:text-amber-400">
              {doublons.map((d) => (
                <li key={d.id}>
                  {`${d.first_name} ${d.last_name}`.trim()}
                  {d.company?.name ? ` — ${d.company.name}` : ""}
                  {d.email ? ` · ${d.email}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">
              Vous pouvez enregistrer malgré tout : deux homonymes, ça existe.
            </p>
          </div>
        )}

        {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

        {contact && confirmDelete && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-xs leading-relaxed text-red-800 dark:text-red-300">
              Supprimer <b>{`${contact.first_name} ${contact.last_name}`.trim() || "ce contact"}</b> ?
              Les interactions déjà enregistrées avec cette personne sont conservées, mais ne lui
              seront plus rattachées. C&apos;est définitif.
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                {busy ? <Spinner /> : "Supprimer définitivement"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button>
            </div>
          </div>
        )}

        <ModalActions>
          {contact && !confirmDelete && (isStaff || contact.created_by === profile?.id) && (
            <Button variant="ghost" className="mr-auto text-red-700 hover:bg-red-50 dark:text-red-400"
              onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} /> Supprimer
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy || !f.company_id}>{busy ? <Spinner /> : "Enregistrer"}</Button>
        </ModalActions>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  INTERACTION                                                        */
/* ------------------------------------------------------------------ */

export function InteractionModal({
  open, onClose, onSaved, companyId, contactId, contacts, companies, interaction, parent,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  companyId?: string; contactId?: string; contacts?: Contact[];
  companies?: { id: string; name: string }[];
  /** Passer une interaction existante bascule la fenêtre en modification. */
  interaction?: Interaction | null;
  /** Passer un message d'origine bascule la fenêtre en réponse à ce message. */
  parent?: Interaction | null;
}) {
  const { profile, settings, isStaff, isAdmin } = useApp();
  const modification = !!interaction;
  const reponse = !modification && !!parent;
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Nombre de réponses rattachées, compté avant d'afficher l'avertissement. */
  const [nbReponses, setNbReponses] = useState(0);
  const [f, setF] = useState<Record<string, string>>({});
  /** Plusieurs interlocuteurs possibles : un email part souvent à deux personnes. */
  const [interlocuteurs, setInterlocuteurs] = useState<string[]>([]);
  const [planFollowUp, setPlanFollowUp] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  /** Tant que l'utilisateur n'a pas choisi, le sens « reçu » peut suggérer un statut. */
  const [statutTouche, setStatutTouche] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyContacts, setCompanyContacts] = useState<Contact[]>(contacts ?? []);

  useEffect(() => {
    if (!open) return;
    setError(null); setNewStatus(""); setConfirmDelete(false);
    setStatutTouche(false); setNbReponses(0);

    const sens = interaction?.direction ?? (parent ? "recu" : "envoye");
    setPlanFollowUp(!interaction && sens === "envoye");
    setF({
      company_id: interaction?.company_id ?? parent?.company_id ?? companyId ?? "",
      channel: interaction?.channel ?? parent?.channel ?? "email",
      outcome: interaction?.outcome ?? "en_attente",
      direction: sens,
      occurred_at: (interaction?.occurred_at ?? today()).slice(0, 10),
      notes: interaction?.notes ?? "",
      message_sent: interaction?.message_sent ?? "",
    });

    // En réponse, on reprend les interlocuteurs du message d'origine : c'est
    // presque toujours aux mêmes personnes qu'on écrit dans un fil.
    const source = interaction ?? parent ?? null;
    const repris = (source?.interaction_contacts ?? [])
      .map((x) => x.contact?.id).filter(Boolean) as string[];
    const initial = repris.length ? repris
      : source?.contact_id ? [source.contact_id]
      : contactId ? [contactId] : [];
    setInterlocuteurs(initial);
    setCompanyContacts(contacts ?? []);
  }, [open, companyId, contactId, contacts, interaction, parent]);

  useEffect(() => {
    const cid = f.company_id;
    if (!open || !cid || contacts) return;
    supabase.from("contacts").select("*").eq("company_id", cid).then(({ data }) => {
      setCompanyContacts((data as Contact[]) ?? []);
    });
  }, [f.company_id, open, contacts]);

  // Les écrans ne chargent pas toujours les interlocuteurs d'un message : on
  // va les chercher, pour ne pas les perdre à l'enregistrement d'une
  // modification, ni les oublier en reprenant un fil.
  const messageSource = interaction ?? parent ?? null;
  useEffect(() => {
    if (!open || !messageSource || messageSource.interaction_contacts) return;
    supabase.from("interaction_contacts").select("contact_id")
      .eq("interaction_id", messageSource.id)
      .then(({ data }) => {
        const ids = ((data as { contact_id: string }[]) ?? []).map((x) => x.contact_id);
        if (ids.length) setInterlocuteurs(ids);
      });
  }, [open, messageSource]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const basculer = (id: string) =>
    setInterlocuteurs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /**
   * Statut proposé automatiquement, jamais imposé.
   *
   * Une relance qui part fait passer l'entreprise en « Relance faite, en
   * attente » : c'est le cas le plus fréquent et personne ne pense à le
   * saisir. Un message reçu, lui, fait sortir de l'attente, mais vers quoi
   * dépend de ce que dit la réponse : c'est donc le résultat choisi qui
   * décide, et non le seul fait d'avoir reçu quelque chose.
   *
   * La proposition disparaît dès que l'utilisateur touche au sélecteur.
   */
  const statutSuggere = (sens: string, resultat: string, canal: string) => {
    if (sens === "envoye") return canal === "relance" ? "relance_faite" : "";
    if (resultat === "positif") return "positif";
    if (resultat === "negatif") return "refus";
    if (resultat === "a_relancer") return "relance";
    return "";
  };

  const suggerer = (sens: string, resultat: string, canal: string) => {
    if (!statutTouche) setNewStatus(statutSuggere(sens, resultat, canal));
  };

  const choisirSens = (sens: string) => {
    set("direction", sens);
    if (!modification) setPlanFollowUp(sens === "envoye");
    suggerer(sens, f.outcome ?? "en_attente", f.channel ?? "email");
  };

  const choisirResultat = (resultat: string) => {
    set("outcome", resultat);
    suggerer(f.direction ?? "envoye", resultat, f.channel ?? "email");
  };

  const choisirCanal = (canal: string) => {
    set("channel", canal);
    suggerer(f.direction ?? "envoye", f.outcome ?? "en_attente", canal);
  };

  const demanderSuppression = async () => {
    if (!interaction) return;
    const { count } = await supabase.from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", interaction.id);
    setNbReponses(count ?? 0);
    setConfirmDelete(true);
  };

  const remove = async () => {
    if (!interaction) return;
    setBusy(true); setError(null);
    // Les réponses partent avec le message d'origine : la clé étrangère est
    // déclarée « on delete cascade » côté base.
    const { error } = await supabase.from("interactions").delete().eq("id", interaction.id);
    setBusy(false);
    if (error) {
      setError(error.message.toLowerCase().includes("policy")
        ? "Seuls l'auteur de l'interaction et un administrateur peuvent la supprimer."
        : error.message);
      return;
    }
    onSaved(); onClose();
  };

  /** Remplace la liste des interlocuteurs rattachés à un message. */
  const enregistrerInterlocuteurs = async (interactionId: string) => {
    await supabase.from("interaction_contacts").delete().eq("interaction_id", interactionId);
    if (!interlocuteurs.length) return;
    await supabase.from("interaction_contacts").insert(
      interlocuteurs.map((contact_id) => ({ interaction_id: interactionId, contact_id }))
    );
  };

  const save = async () => {
    setBusy(true); setError(null);
    const contenu = {
      company_id: f.company_id,
      // contact_id reste le premier interlocuteur, pour les écrans et les
      // statistiques qui s'appuient encore dessus.
      contact_id: interlocuteurs[0] ?? null,
      channel: f.channel,
      outcome: f.outcome,
      direction: f.direction || "envoye",
      occurred_at: new Date(f.occurred_at).toISOString(),
      notes: f.notes || null,
      message_sent: f.message_sent || null,
    };

    // En modification, on ne reprogramme pas de relance : elle l'a déjà été
    // au moment de la saisie initiale.
    if (modification) {
      const { error } = await supabase.from("interactions").update(contenu).eq("id", interaction!.id);
      if (error) {
        setBusy(false);
        setError(error.message.toLowerCase().includes("policy")
          ? "Vous ne pouvez modifier que vos propres interactions."
          : error.message);
        return;
      }
      await enregistrerInterlocuteurs(interaction!.id);
      setBusy(false);
      if (newStatus) await supabase.from("companies").update({ status: newStatus }).eq("id", f.company_id);
      onSaved(); onClose();
      return;
    }

    const { data: cree, error: e1 } = await supabase.from("interactions").insert({
      ...contenu, author_id: profile?.id, parent_id: parent?.id ?? null,
    }).select("id").single();
    if (e1 || !cree) { setBusy(false); setError(e1?.message ?? "Enregistrement impossible."); return; }

    await enregistrerInterlocuteurs(cree.id);

    if (newStatus) {
      await supabase.from("companies").update({ status: newStatus }).eq("id", f.company_id);
    }
    if (planFollowUp && ["email", "linkedin_message", "linkedin_connexion", "appel", "relance"].includes(f.channel)) {
      await supabase.from("follow_ups").insert({
        company_id: f.company_id,
        contact_id: interlocuteurs[0] ?? null,
        assigned_to: profile?.id,
        due_date: addDays(settings?.follow_up_delay_days ?? 7),
        note: "Relance automatique programmée après " + (CHANNELS.find((c) => c.key === f.channel)?.label ?? ""),
        created_by: profile?.id,
      });
    }
    setBusy(false);
    onSaved(); onClose();
  };

  const titre = modification ? "Modifier l'interaction"
    : reponse ? "Ajouter une réponse au fil"
    : "Ajouter une interaction";

  return (
    <Modal open={open} onClose={onClose} title={titre}>
      <div className="space-y-3">
        {reponse && parent && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">En réponse à</p>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {fmtDateShort(parent.occurred_at)} · {labelOf(CHANNELS, parent.channel)}
              {" · "}{directionMeta(parent.direction).label.toLowerCase()}
            </p>
            {parent.notes && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{parent.notes}</p>}
          </div>
        )}

        {!companyId && !reponse && (
          <Field label="Entreprise *">
            <Select value={f.company_id ?? ""} onChange={(e) => set("company_id", e.target.value)}>
              <option value="">— Choisir —</option>
              {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}

        <Field label="Sens du message"
          hint="Qui a écrit : nous, ou l'entreprise. C'est ce qui rend le fil lisible.">
          <div className="flex gap-2">
            {DIRECTIONS.map((d) => {
              const actif = (f.direction ?? "envoye") === d.key;
              return (
                <button key={d.key} type="button" onClick={() => choisirSens(d.key)}
                  className={cx(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
                    actif
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/30 dark:text-brand-300"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
                  )}>
                  {d.key === "envoye" ? "Envoyé par nous" : "Reçu de l'entreprise"}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Canal">
            <Select value={f.channel ?? "email"} onChange={(e) => choisirCanal(e.target.value)}>
              {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Résultat">
            <Select value={f.outcome ?? "en_attente"} onChange={(e) => choisirResultat(e.target.value)}>
              {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Date" hint="Celle du message lui-même, pas celle de la saisie.">
          <Input type="date" value={f.occurred_at ?? ""} onChange={(e) => set("occurred_at", e.target.value)} />
        </Field>

        <Field label="Interlocuteurs"
          hint="Cochez toutes les personnes concernées. Leur statut passe seul à « Contacté », ou à « A répondu » sur un message reçu.">
          {companyContacts.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun contact enregistré pour cette entreprise.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              {companyContacts.map((c) => (
                <label key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input type="checkbox" checked={interlocuteurs.includes(c.id)}
                    onChange={() => basculer(c.id)}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-500" />
                  <span className="text-slate-700 dark:text-slate-200">
                    {`${c.first_name} ${c.last_name}`.trim()}
                  </span>
                  {c.position && <span className="truncate text-[11px] text-slate-400">{c.position}</span>}
                </label>
              ))}
            </div>
          )}
        </Field>

        <Field label="Notes">
          <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
            placeholder="Ce qui a été dit, ce qui est attendu ensuite…" />
        </Field>
        <Field label={(f.direction ?? "envoye") === "recu" ? "Message reçu" : "Message envoyé"}
          hint="Collez ici le message tel quel. Celui qui reprendra le dossier saura ce qui a réellement été écrit.">
          <Textarea rows={4} value={f.message_sent ?? ""} onChange={(e) => set("message_sent", e.target.value)}
            placeholder="Bonjour Madame Dubois, …" />
        </Field>
        <Field label="Faire passer l'entreprise à" hint="Facultatif, met à jour le statut et l'historique">
          <Select value={newStatus}
            onChange={(e) => { setStatutTouche(true); setNewStatus(e.target.value); }}>
            <option value="">Ne pas changer le statut</option>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        </Field>
        {!modification && (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={planFollowUp} onChange={(e) => setPlanFollowUp(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-500" />
            Programmer une relance dans {settings?.follow_up_delay_days ?? 7} jours
          </label>
        )}

        {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

        {confirmDelete && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-xs leading-relaxed text-red-800 dark:text-red-300">
              {nbReponses > 0 ? (
                <>
                  Êtes-vous sûr de vouloir supprimer tout le message ? Cela supprimera
                  également {nbReponses > 1 ? `les ${nbReponses} réponses` : "la réponse"} de
                  ce fil. C&apos;est définitif.
                </>
              ) : (
                <>
                  Supprimer cette interaction ? Elle disparaîtra de l&apos;historique de
                  l&apos;entreprise et du compte rendu. C&apos;est définitif.
                </>
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                {busy ? <Spinner /> : nbReponses > 0 ? "Supprimer le fil" : "Supprimer"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button>
            </div>
          </div>
        )}

        <ModalActions>
          {modification && !confirmDelete
            && (isAdmin || isStaff || interaction?.author_id === profile?.id) && (
            <Button variant="ghost" className="mr-auto text-red-700 hover:bg-red-50 dark:text-red-400"
              onClick={demanderSuppression}>
              <Trash2 size={13} /> Supprimer
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy || !f.company_id}>{busy ? <Spinner /> : "Enregistrer"}</Button>
        </ModalActions>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  RELANCE                                                            */
/* ------------------------------------------------------------------ */

export function FollowUpModal({
  open, onClose, onSaved, companyId, companies,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  companyId?: string; companies?: { id: string; name: string }[];
}) {
  const { profile, settings, editeurs } = useApp();
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF({
      company_id: companyId ?? "",
      due_date: addDays(settings?.follow_up_delay_days ?? 7),
      assigned_to: profile?.id ?? "", note: "",
    });
  }, [open, companyId, profile, settings]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setError(null);
    const { error } = await supabase.from("follow_ups").insert({
      company_id: f.company_id, due_date: f.due_date,
      assigned_to: f.assigned_to || null, note: f.note || null, created_by: profile?.id,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    onSaved(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Programmer une relance">
      <div className="space-y-3">
        {!companyId && (
          <Field label="Entreprise *">
            <Select value={f.company_id ?? ""} onChange={(e) => set("company_id", e.target.value)}>
              <option value="">— Choisir —</option>
              {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de relance"><Input type="date" value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></Field>
          <Field label="Assignée à">
            <Select value={f.assigned_to ?? ""} onChange={(e) => set("assigned_to", e.target.value)}>
              <option value="">—</option>
              {editeurs.map((m) => (
                <option key={m.id} value={m.id}>{fullName(m)}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Note"><Textarea rows={2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} /></Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy || !f.company_id}>{busy ? <Spinner /> : "Programmer"}</Button>
        </ModalActions>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  TACHE                                                              */
/* ------------------------------------------------------------------ */

export function TaskModal({
  open, onClose, onSaved, companyId, companies, task,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  companyId?: string; companies?: { id: string; name: string }[]; task?: Task | null;
}) {
  const { profile, isStaff, editeurs } = useApp();
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = !!task;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    setF({
      title: task?.title ?? "",
      description: task?.description ?? "",
      company_id: task?.company_id ?? companyId ?? "",
      assigned_to: task?.for_team ? EQUIPE : (task?.assigned_to ?? profile?.id ?? ""),
      due_date: task?.due_date ?? "",
      status: task?.status ?? "a_faire",
    });
  }, [open, companyId, profile, task]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setError(null);
    const commun = {
      title: f.title.trim(),
      description: f.description || null,
      company_id: f.company_id || null,
      due_date: f.due_date || null,
      status: f.status,
    };

    /**
     * Une tâche d'équipe est une seule tâche sans responsable, visible par
     * tous : un pense-bête que quelqu'un reprendra. Elle quitte la liste
     * commune dès que quelqu'un s'en charge.
     */
    const equipe = f.assigned_to === EQUIPE;
    const payload = {
      ...commun,
      assigned_to: equipe ? null : (f.assigned_to || null),
      for_team: equipe,
    };
    const res = editing
      ? await supabase.from("tasks").update(payload).eq("id", task!.id)
      : await supabase.from("tasks").insert({ ...payload, created_by: profile?.id });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    onSaved(); onClose();
  };

  const remove = async () => {
    if (!task) return;
    setBusy(true); setError(null);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("policy")
          ? "Vous ne pouvez supprimer que les tâches que vous avez créées ou qui vous sont assignées."
          : error.message
      );
      return;
    }
    onSaved(); onClose();
  };

  const canDelete = !!task && (isStaff || task.created_by === profile?.id || task.assigned_to === profile?.id);

  const suggestions = [
    "Trouver un interlocuteur", "Envoyer un email", "Relancer",
    "Confirmer l'adresse", "Envoyer la plaquette", "Demander le nombre max de participants",
  ];

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Modifier la tâche" : "Nouvelle tâche"}>
      <div className="space-y-3">
        <Field label="Intitulé *">
          <Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Envoyer un email à…" />
        </Field>
        {!editing && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => set("title", s)} type="button"
                className="rounded-sm border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                {s}
              </button>
            ))}
          </div>
        )}
        <Field label="Entreprise liée">
          <Select value={f.company_id ?? ""} onChange={(e) => set("company_id", e.target.value)}>
            <option value="">Aucune</option>
            {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Assignée à"
            hint={f.assigned_to === EQUIPE && !editing
              ? `Une tâche sera créée pour chacun des ${editeurs.length} éditeurs.`
              : undefined}>
            <Select value={f.assigned_to ?? ""} onChange={(e) => set("assigned_to", e.target.value)}>
              <option value="">—</option>
              <option value={EQUIPE}>Toute l&apos;équipe — à prendre en charge</option>
              {editeurs.map((m) => (
                <option key={m.id} value={m.id}>{fullName(m)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Échéance">
            <Input type="date" value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} />
          </Field>
          <Field label="Statut">
            <Select value={f.status ?? "a_faire"} onChange={(e) => set("status", e.target.value)}>
              <option value="a_faire">À faire</option>
              <option value="en_cours">En cours</option>
              <option value="fait">Fait</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={2} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </Field>

        {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

        {confirmDelete && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-xs leading-relaxed text-red-800 dark:text-red-300">
              Supprimer définitivement « {task?.title} » ?
              {task?.for_team && " Elle disparaîtra de la liste de toute l'équipe."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                {busy ? <Spinner /> : "Supprimer"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button>
            </div>
          </div>
        )}

        <ModalActions>
          {canDelete && !confirmDelete && (
            <Button variant="ghost" className="mr-auto text-red-700 hover:bg-red-50 dark:text-red-400"
              onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} /> Supprimer
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy || !f.title?.trim()}>
            {busy ? <Spinner /> : editing ? "Enregistrer" : "Créer"}
          </Button>
        </ModalActions>
      </div>
    </Modal>
  );
}


/* ------------------------------------------------------------------ */
/*  VISITE                                                             */
/* ------------------------------------------------------------------ */

export function VisitModal({
  open, onClose, onSaved, companyId, companies, visit,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  companyId?: string; companies?: { id: string; name: string }[]; visit?: Record<string, unknown> | null;
}) {
  const { profile, poles, editeurs } = useApp();
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const v = (visit ?? {}) as Record<string, string | number | null>;
    setF({
      company_id: (v.company_id as string) ?? companyId ?? "",
      visit_date: (v.visit_date as string) ?? "",
      start_time: (v.start_time as string)?.slice(0, 5) ?? "",
      end_time: (v.end_time as string)?.slice(0, 5) ?? "",
      address: (v.address as string) ?? "",
      max_participants: v.max_participants != null ? String(v.max_participants) : "",
      min_participants: v.min_participants != null ? String(v.min_participants) : "",
      speaker: (v.speaker as string) ?? "",
      contact_phone: (v.contact_phone as string) ?? "",
      contact_email: (v.contact_email as string) ?? "",
      language: (v.language as string) ?? "Anglais",
      visit_type: (v.visit_type as string) ?? "",
      confirmation: (v.confirmation as string) ?? "a_confirmer",
      pole_id: (v.pole_id as string) ?? profile?.pole_id ?? "",
      owner_id: (v.owner_id as string) ?? profile?.id ?? "",
    });
  }, [open, visit, companyId, profile]);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setError(null);
    const payload = {
      company_id: f.company_id,
      visit_date: f.visit_date || null,
      start_time: f.start_time || null,
      end_time: f.end_time || null,
      address: f.address || null,
      max_participants: f.max_participants ? Number(f.max_participants) : null,
      min_participants: f.min_participants ? Number(f.min_participants) : null,
      speaker: f.speaker || null,
      contact_phone: f.contact_phone || null,
      contact_email: f.contact_email || null,
      language: f.language || null,
      visit_type: f.visit_type || null,
      confirmation: f.confirmation,
      pole_id: f.pole_id || null,
      owner_id: f.owner_id || null,
    };
    const { error } = await supabase.from("visits").upsert(payload, { onConflict: "company_id" });
    if (!error && f.confirmation === "confirmee") {
      await supabase.from("companies").update({ status: "visite_confirmee" }).eq("id", f.company_id);
    }
    setBusy(false);
    if (error) { setError(error.message); return; }
    onSaved(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Visite" wide>
      <div className="space-y-3">
        {!companyId && (
          <Field label="Entreprise *">
            <Select value={f.company_id ?? ""} onChange={(e) => set("company_id", e.target.value)}>
              <option value="">— Choisir —</option>
              {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date"><Input type="date" value={f.visit_date ?? ""} onChange={(e) => set("visit_date", e.target.value)} /></Field>
          <Field label="Début"><Input type="time" value={f.start_time ?? ""} onChange={(e) => set("start_time", e.target.value)} /></Field>
          <Field label="Fin"><Input type="time" value={f.end_time ?? ""} onChange={(e) => set("end_time", e.target.value)} /></Field>
        </div>
        <Field label="Adresse de la visite"><Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Participants min"><Input type="number" value={f.min_participants ?? ""} onChange={(e) => set("min_participants", e.target.value)} /></Field>
          <Field label="Participants max"><Input type="number" value={f.max_participants ?? ""} onChange={(e) => set("max_participants", e.target.value)} /></Field>
          <Field label="Langue"><Input value={f.language ?? ""} onChange={(e) => set("language", e.target.value)} /></Field>
          <Field label="Type de visite"><Input value={f.visit_type ?? ""} onChange={(e) => set("visit_type", e.target.value)} placeholder="Conférence, atelier…" /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Intervenant"><Input value={f.speaker ?? ""} onChange={(e) => set("speaker", e.target.value)} /></Field>
          <Field label="Téléphone du contact"><Input value={f.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></Field>
          <Field label="Email du contact"><Input value={f.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pôle">
            <Select value={f.pole_id ?? ""} onChange={(e) => set("pole_id", e.target.value)}>
              <option value="">—</option>
              {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={f.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">—</option>
              {editeurs.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </Select>
          </Field>
          <Field label="Confirmation">
            <Select value={f.confirmation ?? "a_confirmer"} onChange={(e) => set("confirmation", e.target.value)}>
              <option value="a_confirmer">À confirmer</option>
              <option value="confirmee">Confirmée</option>
              <option value="annulee">Annulée</option>
            </Select>
          </Field>
        </div>
        {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy || !f.company_id}>{busy ? <Spinner /> : "Enregistrer"}</Button>
        </ModalActions>
      </div>
    </Modal>
  );
}
