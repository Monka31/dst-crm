"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone, Linkedin, Pencil, Star, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Spinner, Textarea } from "@/components/ui";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ContactModal, InteractionModal } from "@/components/forms";
import { NotesContact } from "@/components/NotesContact";
import { CHANNELS, RELATION_TYPES, contactStatusMeta, directionMeta, emailStatusMeta, labelOf, statusMeta } from "@/lib/constants";
import { fmtDate, fmtDateTime, fullName, initials } from "@/lib/format";
import type { Contact, ContactNote, Interaction } from "@/lib/types";

export default function FicheContact() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, canWrite, settings } = useApp();

  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [interOpen, setInterOpen] = useState(false);
  const [editInteraction, setEditInteraction] = useState<Interaction | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [c, n, i, co] = await Promise.all([
      supabase.from("contacts")
        .select("*, company:companies(id,name,status,logo_url,website_domain), referrer:profiles!contacts_referred_by_fkey(id,first_name,last_name)")
        .eq("id", id).maybeSingle(),
      supabase.from("contact_notes")
        .select("id,body,pinned,created_at, author:profiles(first_name,last_name)")
        .eq("contact_id", id).eq("pinned", true).order("created_at", { ascending: false }),
      supabase.from("interaction_contacts").select("interaction_id").eq("contact_id", id),
      supabase.from("companies").select("id,name").order("name"),
    ]);
    setContact((c.data as unknown as Contact) ?? null);
    setNotes((n.data as unknown as ContactNote[]) ?? []);
    setCompanies((co.data as { id: string; name: string }[]) ?? []);

    // Un message peut concerner plusieurs interlocuteurs : on passe par la
    // table de liaison pour retrouver aussi ceux où la personne n'était pas
    // l'interlocuteur principal.
    const ids = ((i.data as { interaction_id: string }[]) ?? []).map((x) => x.interaction_id);
    if (ids.length) {
      const { data: ech } = await supabase.from("interactions")
        .select("*, author:profiles(first_name,last_name), company:companies(name)")
        .in("id", ids).order("occurred_at", { ascending: false });
      setInteractions((ech as unknown as Interaction[]) ?? []);
    } else setInteractions([]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["contact_notes", "interactions"], load, `contact-${id}`);

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
  const surPlace = !!settings?.trip_city && !!contact.city
    && contact.city.trim().toLowerCase() === settings.trip_city.trim().toLowerCase();

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
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>
                  {contact.position ?? "Poste non renseigné"}
                  {contact.department ? ` · ${contact.department}` : ""}
                </span>
                {(contact.city || contact.country) && (
                  <span className="inline-flex items-center gap-1 text-[12.5px]">
                    <MapPin size={12} className={surPlace ? "text-emerald-600" : "text-slate-400"} />
                    {[contact.city, contact.country].filter(Boolean).join(", ")}
                    {surPlace && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Sur place
                      </Badge>
                    )}
                  </span>
                )}
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

        <div className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800">
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
          <Info label="Localisation">
            {[contact.city, contact.country].filter(Boolean).join(", ") || <span className="text-slate-400">—</span>}
          </Info>
          <Info label="Présenté par">
            {presentePar ?? <span className="text-slate-400">—</span>}
          </Info>
        </div>
      </Card>

      {notes.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            À savoir avant d&apos;écrire
          </p>
          <ul className="mt-1.5 space-y-1">
            {notes.map((n) => (
              <li key={n.id} className="text-[13px] leading-relaxed text-amber-900 dark:text-amber-200">
                {n.body}
                <span className="ml-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                  — {fullName(n.author) || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col overflow-hidden">
          <h2 className="card-title border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            Notes et commentaires
          </h2>
          <NotesContact contactId={contact.id} onChange={load} />
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
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-slate-800 dark:text-slate-200">
                    <span>{labelOf(CHANNELS, i.channel)} · {fmtDate(i.occurred_at)}</span>
                    <Badge className={directionMeta(i.direction).chip}>{directionMeta(i.direction).label}</Badge>
                    {i.parent_id && <span className="text-[11px] font-normal text-slate-400">réponse dans un fil</span>}
                  </p>
                  {i.notes && <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">{i.notes}</p>}
                  {i.message_sent && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11.5px] text-slate-500 hover:text-brand-700">
                        {i.direction === "recu" ? "Message reçu" : "Message envoyé"}
                      </summary>
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
