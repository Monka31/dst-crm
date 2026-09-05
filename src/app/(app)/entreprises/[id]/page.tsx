"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Plus, MessageSquarePlus, BellPlus, CalendarPlus,
  Globe, Linkedin, MapPin, Star, Mail, Phone, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Select, Spinner, Textarea, cx } from "@/components/ui";
import { CompanyModal, ContactModal, FollowUpModal, InteractionModal, TaskModal, VisitModal } from "@/components/forms";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CHANNELS, OUTCOMES, PRIORITIES, RELATION_TYPES, SOURCES, STATUSES, labelOf, statusMeta } from "@/lib/constants";
import { fmtDate, fmtDateTime, fullName, initials, relative } from "@/lib/format";
import type { Activity, Company, Contact, FollowUp, Interaction, Note, Task, Visit } from "@/lib/types";

const TABS = ["Vue d'ensemble", "Contacts", "Historique", "Visite", "Notes"] as const;

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canWrite, isAdmin, members, profile } = useApp();

  const [c, setC] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [tab, setTab] = useState<typeof TABS[number]>("Vue d'ensemble");
  const [modal, setModal] = useState<null | "edit" | "contact" | "interaction" | "followup" | "task" | "visit">(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editInteraction, setEditInteraction] = useState<Interaction | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [co, ct, it, ac, fu, tk, nt, vs] = await Promise.all([
      supabase.from("companies")
        .select("*, pole:poles(id,name,color), owner:profiles!companies_owner_id_fkey(id,first_name,last_name)")
        .eq("id", id).maybeSingle(),
      supabase.from("contacts").select("*").eq("company_id", id).order("is_primary", { ascending: false }),
      supabase.from("interactions")
        .select("*, author:profiles(first_name,last_name), contact:contacts(first_name,last_name)")
        .eq("company_id", id).order("occurred_at", { ascending: false }),
      supabase.from("activity_log").select("*, actor:profiles(first_name,last_name)")
        .eq("company_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("follow_ups")
        .select("*, assignee:profiles!follow_ups_assigned_to_fkey(first_name,last_name)")
        .eq("company_id", id).order("due_date"),
      supabase.from("tasks").select("*, assignee:profiles!tasks_assigned_to_fkey(first_name,last_name)")
        .eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("notes").select("*, author:profiles(first_name,last_name)")
        .eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("visits").select("*").eq("company_id", id).maybeSingle(),
    ]);
    setC((co.data as unknown as Company) ?? null);
    setContacts((ct.data as Contact[]) ?? []);
    setInteractions((it.data as unknown as Interaction[]) ?? []);
    setActivity((ac.data as unknown as Activity[]) ?? []);
    setFollowUps((fu.data as unknown as FollowUp[]) ?? []);
    setTasks((tk.data as unknown as Task[]) ?? []);
    setNotes((nt.data as unknown as Note[]) ?? []);
    setVisit((vs.data as Visit) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["companies", "contacts", "interactions", "follow_ups", "tasks", "notes", "visits", "activity_log"], load, `co-${id}`);

  if (loading) return <Spinner className="h-6 w-6" />;
  if (!c) return <EmptyState title="Entreprise introuvable" />;

  const update = async (patch: Partial<Company>) => {
    setC({ ...c, ...patch } as Company);
    await supabase.from("companies").update(patch).eq("id", c.id);
    load();
  };

  const addNote = async () => {
    if (!noteBody.trim()) return;
    await supabase.from("notes").insert({ company_id: c.id, author_id: profile?.id, body: noteBody.trim() });
    setNoteBody(""); load();
  };

  const remove = async () => {
    if (!confirm(`Supprimer définitivement ${c.name} et toutes ses données liées ?`)) return;
    await supabase.from("companies").delete().eq("id", c.id);
    router.push("/entreprises");
  };

  const completeFollowUp = async (fid: string, st: "fait" | "annule") => {
    await supabase.from("follow_ups").update({ status: st, completed_at: new Date().toISOString() }).eq("id", fid);
    load();
  };

  return (
    <div className="space-y-5">
      <Link href="/entreprises" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={15} /> Toutes les entreprises
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            <CompanyLogo name={c.name} logoUrl={c.logo_url} domain={c.website_domain} size={64} className="p-1.5" />
            <div className="min-w-0">
              <h1 className="page-title">{c.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                {c.sector && <span>{c.sector}</span>}
                {(c.city || c.country) && <span className="inline-flex items-center gap-1"><MapPin size={13} />{[c.city, c.country].filter(Boolean).join(", ")}</span>}
                {c.website && <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-brand-600"><Globe size={13} />{c.website_domain}</a>}
                {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-brand-600"><Linkedin size={13} />LinkedIn</a>}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {canWrite ? (
                  <select value={c.status} onChange={(e) => update({ status: e.target.value })}
                    className={cx("cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none", statusMeta(c.status).chip)}>
                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                ) : <Badge className={statusMeta(c.status).chip}>{statusMeta(c.status).label}</Badge>}
                {c.pole && <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.pole.color }} />{c.pole.name}
                </Badge>}
                <Badge className={PRIORITIES.find((p) => p.key === c.priority)?.chip}>Priorité {c.priority}</Badge>
                {canWrite ? (
                  <select value={c.owner_id ?? ""} onChange={(e) => update({ owner_id: e.target.value || null } as Partial<Company>)}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs outline-none dark:bg-slate-800">
                    <option value="">Non attribuée</option>
                    {members.filter((m) => m.role !== "viewer").map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
                  </select>
                ) : <Badge className="bg-slate-100 text-slate-600">{fullName(c.owner) || "Non attribuée"}</Badge>}
              </div>
            </div>
          </div>

          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setModal("edit")}><Pencil size={14} /> Modifier</Button>
              <Button size="sm" variant="secondary" onClick={() => { setEditContact(null); setModal("contact"); }}><Plus size={14} /> Contact</Button>
              <Button size="sm" onClick={() => { setEditInteraction(null); setModal("interaction"); }}><MessageSquarePlus size={14} /> Interaction</Button>
              <Button size="sm" variant="secondary" onClick={() => setModal("followup")}><BellPlus size={14} /> Relance</Button>
              <Button size="sm" variant="secondary" onClick={() => setModal("visit")}><CalendarPlus size={14} /> Visite</Button>
              {isAdmin && <Button size="sm" variant="ghost" onClick={remove}><Trash2 size={14} /></Button>}
            </div>
          )}
        </div>

        {/* Un refus expliqué évite qu'un camarade reparte de zéro. */}
        {c.refusal_reason && (
          <div className="mt-4 rounded border border-red-200 bg-red-50/70 px-3.5 py-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
              Motif du refus
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-red-900 dark:text-red-200">
              {c.refusal_reason}
            </p>
            {c.retry_next_year && (
              <Badge className="mt-2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                À retenter l&apos;an prochain
              </Badge>
            )}
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cx("whitespace-nowrap border-b-2 px-3.5 py-2 text-sm transition",
              tab === t ? "border-brand-500 font-semibold text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>
            {t}
            {t === "Contacts" && contacts.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{contacts.length}</span>}
            {t === "Historique" && interactions.length > 0 && <span className="ml-1.5 text-xs text-slate-400">{interactions.length}</span>}
          </button>
        ))}
      </div>

      {/* ---- Vue d'ensemble ---- */}
      {tab === "Vue d'ensemble" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <h3 className="card-title mb-3">Informations</h3>
            {c.description && <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{c.description}</p>}
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Info label="Site internet" value={c.website} link={c.website ? (c.website.startsWith("http") ? c.website : `https://${c.website}`) : null} />
              <Info label="Secteur" value={c.sector} />
              <Info label="Sous-secteur" value={c.subsector} />
              <Info label="Effectif" value={c.employee_count} />
              <Info label="Chiffre d'affaires" value={c.revenue} />
              <Info label="Adresse" value={c.address} />
              <Info label="Ville / Pays" value={[c.city, c.country].filter(Boolean).join(", ") || null} />
              <Info label="Source de découverte" value={labelOf(SOURCES, c.source)} />
              <Info label="Ajoutée le" value={fmtDate(c.created_at)} />
              <Info label="Dernière interaction" value={relative(c.last_interaction_at)} />
              <Info label="Contacts identifiés" value={String(contacts.length)} />
            </dl>
          </Card>

          <div className="space-y-5">
            <Card className="p-4">
              <h3 className="card-title mb-2">Relances</h3>
              {followUps.filter((f) => f.status === "a_faire").length === 0 && (
                <p className="text-xs text-slate-400">Aucune relance programmée.</p>
              )}
              <ul className="space-y-2">
                {followUps.filter((f) => f.status === "a_faire").map((f) => (
                  <li key={f.id} className="rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60">
                    <p className="font-medium">{fmtDate(f.due_date)}
                      {new Date(f.due_date) <= new Date() && <span className="ml-1.5 text-brand-600">· à faire</span>}
                    </p>
                    {f.note && <p className="mt-0.5 text-slate-500">{f.note}</p>}
                    <p className="mt-0.5 text-slate-400">{fullName(f.assignee) || "non assignée"}</p>
                    {canWrite && (
                      <div className="mt-1.5 flex gap-1.5">
                        <Button size="sm" variant="success" onClick={() => completeFollowUp(f.id, "fait")}>Fait</Button>
                        <Button size="sm" variant="ghost" onClick={() => completeFollowUp(f.id, "annule")}>Annuler</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Tâches</h3>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => setModal("task")}><Plus size={13} /></Button>}
              </div>
              {tasks.length === 0 && <p className="text-xs text-slate-400">Aucune tâche.</p>}
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={t.status === "fait"} disabled={!canWrite}
                      onChange={async (e) => {
                        await supabase.from("tasks").update({ status: e.target.checked ? "fait" : "a_faire" }).eq("id", t.id);
                        load();
                      }}
                      className="h-3.5 w-3.5 accent-brand-500" />
                    <span className={cx(t.status === "fait" && "text-slate-400 line-through")}>{t.title}</span>
                    {t.due_date && <span className="ml-auto text-slate-400">{fmtDate(t.due_date)}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* ---- Contacts ---- */}
      {tab === "Contacts" && (
        <Card>
          {contacts.length === 0 ? (
            <EmptyState title="Aucun interlocuteur identifié" hint="Ajoutez la personne à qui vous allez écrire."
              action={canWrite ? <Button size="sm" className="mt-3" onClick={() => { setEditContact(null); setModal("contact"); }}><Plus size={14} /> Ajouter un contact</Button> : undefined} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((ct) => (
                <div key={ct.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="flex gap-3">
                    <Avatar name={initials(ct)} size={34} />
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {`${ct.first_name} ${ct.last_name}`.trim() || "Sans nom"}
                        {ct.is_primary && <Star size={13} className="fill-amber-400 text-amber-400" />}
                      </p>
                      <p className="text-xs text-slate-500">{ct.position ?? "—"}{ct.department ? ` · ${ct.department}` : ""}</p>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-500">
                        {ct.email && <a href={`mailto:${ct.email}`} className="inline-flex items-center gap-1 hover:text-brand-600"><Mail size={12} />{ct.email}</a>}
                        {ct.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{ct.phone}</span>}
                        {ct.linkedin_url && <a href={ct.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-600"><Linkedin size={12} />Profil</a>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {labelOf(RELATION_TYPES, ct.relation_type)}
                    </Badge>
                    <Badge className={ct.relevance === 3 ? "bg-emerald-100 text-emerald-700" : ct.relevance === 2 ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-400"}>
                      Pertinence {ct.relevance === 3 ? "élevée" : ct.relevance === 2 ? "moyenne" : "faible"}
                    </Badge>
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => { setEditContact(ct); setModal("contact"); }}><Pencil size={13} /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ---- Historique ---- */}
      {tab === "Historique" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="card-title mb-4">Interactions</h3>
            {interactions.length === 0 && <p className="text-sm text-slate-400">Aucune interaction enregistrée.</p>}
            <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
              {interactions.map((i) => (
                <li key={i.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900" />
                  <p className="text-sm font-medium">
                    {fmtDate(i.occurred_at)} — {labelOf(CHANNELS, i.channel)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fullName(i.author) || "—"}
                    {i.contact ? ` → ${fullName(i.contact)}` : ""} · {labelOf(OUTCOMES, i.outcome)}
                  </p>
                  {i.notes && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{i.notes}</p>}
                  {i.message_sent && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-brand-700">Message envoyé</summary>
                      <p className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-[11.5px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        {i.message_sent}
                      </p>
                    </details>
                  )}
                  {canWrite && (
                    <button onClick={() => { setEditInteraction(i); setModal("interaction"); }}
                      className="mt-1 text-[11px] text-slate-400 hover:text-brand-700">
                      Modifier
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <h3 className="card-title mb-4">Journal automatique</h3>
            <ol className="space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2.5 text-xs">
                  <Avatar name={initials(a.actor)} size={22} />
                  <div>
                    <p className="text-slate-600 dark:text-slate-300">
                      <b>{fullName(a.actor) || "Système"}</b> — {a.action.replace(/_/g, " ")} {a.label ? `· ${a.label}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400">{fmtDateTime(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {/* ---- Visite ---- */}
      {tab === "Visite" && (
        <Card className="p-5">
          {!visit ? (
            <EmptyState title="Aucune visite planifiée"
              hint="Créez la fiche visite dès que l'entreprise accepte de recevoir le groupe."
              action={canWrite ? <Button size="sm" className="mt-3" onClick={() => setModal("visit")}><CalendarPlus size={14} /> Créer la visite</Button> : undefined} />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Détails de la visite</h3>
                <div className="flex items-center gap-2">
                  <Badge className={visit.confirmation === "confirmee" ? "bg-green-100 text-green-800"
                    : visit.confirmation === "annulee" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}>
                    {visit.confirmation === "confirmee" ? "Confirmée" : visit.confirmation === "annulee" ? "Annulée" : "À confirmer"}
                  </Badge>
                  {canWrite && <Button size="sm" variant="secondary" onClick={() => setModal("visit")}><Pencil size={13} /> Modifier</Button>}
                </div>
              </div>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                <Info label="Date" value={fmtDate(visit.visit_date)} />
                <Info label="Horaires" value={[visit.start_time?.slice(0, 5), visit.end_time?.slice(0, 5)].filter(Boolean).join(" – ") || null} />
                <Info label="Langue" value={visit.language} />
                <Info label="Adresse" value={visit.address} />
                <Info label="Participants" value={visit.min_participants || visit.max_participants ? `${visit.min_participants ?? "?"} – ${visit.max_participants ?? "?"}` : null} />
                <Info label="Type de visite" value={visit.visit_type} />
                <Info label="Intervenant" value={visit.speaker} />
                <Info label="Téléphone" value={visit.contact_phone} />
                <Info label="Email" value={visit.contact_email} />
              </dl>
            </>
          )}
        </Card>
      )}

      {/* ---- Notes ---- */}
      {tab === "Notes" && (
        <Card className="p-5">
          {canWrite && (
            <div className="mb-4">
              <Textarea rows={2} value={noteBody} onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Ex. « Le contact préfère être appelé le matin. »" />
              <Button size="sm" className="mt-2" onClick={addNote} disabled={!noteBody.trim()}>Ajouter la note</Button>
            </div>
          )}
          {notes.length === 0 && <p className="text-sm text-slate-400">Aucune note pour l&apos;instant.</p>}
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm text-slate-700 dark:text-slate-300">{n.body}</p>
                <p className="mt-1.5 text-[11px] text-slate-400">{fullName(n.author) || "—"} · {fmtDateTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CompanyModal open={modal === "edit"} company={c} onClose={() => setModal(null)} onSaved={() => load()} />
      <ContactModal open={modal === "contact"} companyId={c.id} contact={editContact}
        companies={allCompanies}
        onClose={() => { setModal(null); setEditContact(null); }} onSaved={load} />
      <InteractionModal open={modal === "interaction"} companyId={c.id} contacts={contacts}
        interaction={editInteraction}
        onClose={() => { setModal(null); setEditInteraction(null); }} onSaved={load} />
      <FollowUpModal open={modal === "followup"} companyId={c.id} onClose={() => setModal(null)} onSaved={load} />
      <TaskModal open={modal === "task"} companyId={c.id} onClose={() => setModal(null)} onSaved={load} />
      <VisitModal open={modal === "visit"} companyId={c.id} visit={visit as unknown as Record<string, unknown>}
        onClose={() => setModal(null)} onSaved={load} />
    </div>
  );
}

function Info({ label, value, link }: { label: string; value?: string | null; link?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700 dark:text-slate-300">
        {link ? <a href={link} target="_blank" rel="noreferrer" className="hover:text-brand-600">{value}</a> : (value || "—")}
      </dd>
    </div>
  );
}
