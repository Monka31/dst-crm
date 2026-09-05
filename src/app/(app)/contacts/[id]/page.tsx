"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, Linkedin, Pencil, Trash2, Star, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Spinner, Textarea } from "@/components/ui";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ContactModal, InteractionModal } from "@/components/forms";
import { CHANNELS, RELATION_TYPES, contactStatusMeta, emailStatusMeta, labelOf, statusMeta } from "@/lib/constants";
import { fmtDate, fmtDateTime, fullName, initials } from "@/lib/format";
import type { Contact, ContactNote, Interaction } from "@/lib/types";

export default function FicheContact() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, canWrite, isAdmin, members } = useApp();

  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [interOpen, setInterOpen] = useState(false);
  const [editInteraction, setEditInteraction] = useState<Interaction | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [c, n, i, co] = await Promise.all([
      supabase.from("contacts")
        .select("*, company:companies(id,name,status,logo_url,website_domain), referrer:profiles!contacts_referred_by_fkey(id,first_name,last_name)")
        .eq("id", id).maybeSingle(),
      supabase.from("contact_notes")
        .select("*, author:profiles(first_name,last_name)")
        .eq("contact_id", id).order("created_at", { ascending: false }),
      supabase.from("interactions")
        .select("*, author:profiles(first_name,last_name), company:companies(name)")
        .eq("contact_id", id).order("occurred_at", { ascending: false }),
      supabase.from("companies").select("id,name").order("name"),
    ]);
    setContact((c.data as unknown as Contact) ?? null);
    setNotes((n.data as unknown as ContactNote[]) ?? []);
    setInteractions((i.data as unknown as Interaction[]) ?? []);
    setCompanies((co.data as { id: string; name: string }[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["contact_notes", "interactions"], load, `contact-${id}`);

  const ajouterNote = async () => {
    const texte = brouillon.trim();
    if (!texte || !profile) return;
    setBusy(true);
    const { error } = await supabase.from("contact_notes")
      .insert({ contact_id: id, author_id: profile.id, body: texte });
    setBusy(false);
    if (!error) { setBrouillon(""); load(); }
  };

  const supprimerNote = async (noteId: string) => {
    await supabase.from("contact_notes").delete().eq("id", noteId);
    load();
  };

  if (loading) return <Card className="p-8"><Spinner /></Card>;
  if (!contact) {
    return (
      <Card>
        <EmptyState title="Contact introuvable"
          hint="Il a peut-être été supprimé."
          action={<Button size="sm" className="mt-3" onClick={() => router.push("/contacts")}>Retour aux contacts</Button>} />
      </Card>
    );
  }

  const nom = `${contact.first_name} ${contact.last_name}`.trim() || "Contact sans nom";
  const statut = contactStatusMeta(contact.status);
  const email = emailStatusMeta(contact.email_status);
  const presentePar = contact.referrer
    ? fullName(contact.referrer)
    : contact.referred_by_name ?? null;

  return (
    <div className="space-y-4">
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-brand-700">
        <ArrowLeft size={14} /> Tous les contacts
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Avatar name={initials(contact)} size={44} />
            <div>
              <h1 className="flex items-center gap-2 font-serif text-[22px] font-semibold leading-tight text-navy-900 dark:text-slate-100">
                {nom}
                {contact.is_primary && <Star size={15} className="fill-amber-400 text-amber-400" />}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {contact.position ?? "Poste non renseigné"}
                {contact.department ? ` · ${contact.department}` : ""}
              </p>
              {contact.company && (
                <Link href={`/entreprises/${contact.company.id}`}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-brand-700 dark:text-slate-200">
                  <CompanyLogo name={contact.company.name} logoUrl={contact.company.logo_url}
                    domain={contact.company.website_domain} size={22} />
                  {contact.company.name}
                  <Badge className={statusMeta(contact.company.status).chip}>
                    {statusMeta(contact.company.status).label}
                  </Badge>
                </Link>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge className={statut.chip}>{statut.label}</Badge>
                {contact.email && <Badge className={email.chip}>{email.label}</Badge>}
                {contact.relation_type && (
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {labelOf(RELATION_TYPES, contact.relation_type)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditInteraction(null); setInterOpen(true); }}>
                <Plus size={13} /> Interaction
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={13} /> Modifier
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <Info label="Email" >
            {contact.email
              ? <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                  <Mail size={13} className="shrink-0 text-slate-400" />
                  <span className="truncate">{contact.email}</span>
                </a>
              : "—"}
          </Info>
          <Info label="Téléphone">
            {contact.phone
              ? <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                  <Phone size={13} className="shrink-0 text-slate-400" />{contact.phone}
                </a>
              : "—"}
          </Info>
          <Info label="LinkedIn">
            {contact.linkedin_url
              ? <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-brand-700">
                  <Linkedin size={13} className="shrink-0 text-slate-400" /> Profil
                </a>
              : "—"}
          </Info>
          <Info label="Présenté par">
            {presentePar ?? <span className="text-slate-400">—</span>}
          </Info>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <h2 className="card-title border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            Notes ({notes.length})
          </h2>

          {canWrite && (
            <div className="border-b border-slate-100 p-3 dark:border-slate-800">
              <Textarea
                rows={3}
                value={brouillon}
                onChange={(e) => setBrouillon(e.target.value)}
                placeholder="Contact obtenu via Léa (promo MMD) — elle a travaillé avec lui en stage. Préfère être appelé le matin."
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={ajouterNote} disabled={busy || !brouillon.trim()}>
                  {busy ? <Spinner /> : "Ajouter la note"}
                </Button>
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">
              Aucune note. Notez ici d&apos;où vient ce contact et ce qu&apos;il faut savoir avant de l&apos;appeler.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notes.map((n) => (
                <li key={n.id} className="group px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">{n.body}</p>
                    {(n.author_id === profile?.id || isAdmin) && (
                      <button onClick={() => supprimerNote(n.id)} aria-label="Supprimer la note"
                        className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {fullName(n.author) || "Auteur inconnu"} · {fmtDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <h2 className="card-title border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            Historique des échanges ({interactions.length})
          </h2>
          {interactions.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-slate-400">
              Aucun échange enregistré avec cette personne.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {interactions.map((i) => (
                <li key={i.id} className="px-4 py-3">
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                    {labelOf(CHANNELS, i.channel)} · {fmtDate(i.occurred_at)}
                  </p>
                  {i.notes && <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">{i.notes}</p>}
                  {i.message_sent && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11.5px] text-slate-500 hover:text-brand-700">Message envoyé</summary>
                      <p className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-[12px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        {i.message_sent}
                      </p>
                    </details>
                  )}
                  <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    {fullName(i.author) || "Auteur inconnu"}
                    {canWrite && (
                      <button onClick={() => { setEditInteraction(i); setInterOpen(true); }}
                        className="hover:text-brand-700">Modifier</button>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ContactModal open={editOpen} contact={contact} companies={companies}
        onClose={() => setEditOpen(false)} onSaved={load} />
      <InteractionModal open={interOpen} companyId={contact.company_id} contactId={contact.id}
        interaction={editInteraction}
        onClose={() => { setInterOpen(false); setEditInteraction(null); }} onSaved={load} />
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="label mb-1">{label}</p>
      <p className="truncate text-[13px] text-slate-700 dark:text-slate-300">{children}</p>
    </div>
  );
}
