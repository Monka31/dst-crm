"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Search, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Badge, Button, Card, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { ContactModal } from "@/components/forms";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CONTACT_STATUSES, RELATION_TYPES, contactStatusMeta, emailStatusMeta, labelOf, statusMeta } from "@/lib/constants";
import { download, toCsv } from "@/lib/format";
import type { Contact } from "@/lib/types";

export default function ContactsPage() {
  const { canWrite } = useApp();
  const [rows, setRows] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rel, setRel] = useState("");
  const [stat, setStat] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    const [c, co] = await Promise.all([
      supabase.from("contacts")
        .select("*, company:companies(id,name,status,logo_url,website_domain), referrer:profiles!contacts_referred_by_fkey(id,first_name,last_name)")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id,name").order("name"),
    ]);
    setRows((c.data as unknown as Contact[]) ?? []);
    setCompanies((co.data as { id: string; name: string }[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(["contacts"], load, "contacts");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (rel && r.relation_type !== rel) return false;
      if (stat && (r.status ?? "a_contacter") !== stat) return false;
      if (!t) return true;
      return `${r.first_name} ${r.last_name} ${r.position ?? ""} ${r.email ?? ""} ${r.company?.name ?? ""}`
        .toLowerCase().includes(t);
    });
  }, [rows, q, rel, stat]);

  const exportCsv = () => download("contacts-dst.csv", toCsv(filtered.map((r) => ({
    Prénom: r.first_name, Nom: r.last_name, Poste: r.position ?? "", Département: r.department ?? "",
    Email: r.email ?? "", Téléphone: r.phone ?? "", LinkedIn: r.linkedin_url ?? "",
    Relation: labelOf(RELATION_TYPES, r.relation_type), Entreprise: r.company?.name ?? "",
    Statut: contactStatusMeta(r.status).label,
    "Fiabilité email": emailStatusMeta(r.email_status).label,
    "Présenté par": r.referrer ? `${r.referrer.first_name} ${r.referrer.last_name}`.trim() : (r.referred_by_name ?? ""),
    Prioritaire: r.is_primary ? "oui" : "non",
  }))));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="text-sm text-slate-500">{filtered.length} interlocuteur{filtered.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
          {canWrite && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus size={14} /> Ajouter</Button>}
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, poste, email, entreprise…" className="pl-8" />
          </div>
          <Select value={rel} onChange={(e) => setRel(e.target.value)} className="w-auto min-w-[180px]">
            <option value="">Tous les types de relation</option>
            {RELATION_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
          <Select value={stat} onChange={(e) => setStat(e.target.value)} className="w-auto min-w-[170px]">
            <option value="">Tous les statuts</option>
            {CONTACT_STATUSES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8"><Spinner /></div>
          : filtered.length === 0 ? <EmptyState title="Aucun contact" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="th">Nom</th><th className="th">Poste</th><th className="th">Entreprise</th>
                    <th className="th">Email</th><th className="th">Statut</th><th className="th">Relation</th>
                    {canWrite && <th className="th"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((r) => (
                    <tr key={r.id} className="row-hover">
                      <td className="td font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <Link href={`/contacts/${r.id}`} className="hover:text-brand-700">
                            {`${r.first_name} ${r.last_name}`.trim() || "—"}
                          </Link>
                          {r.is_primary && <Star size={12} className="fill-amber-400 text-amber-400" />}
                        </span>
                        {(r.referrer || r.referred_by_name) && (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            via {r.referrer ? `${r.referrer.first_name} ${r.referrer.last_name}`.trim() : r.referred_by_name}
                          </p>
                        )}
                      </td>
                      <td className="td text-slate-500">{r.position ?? "—"}</td>
                      <td className="td">
                        {r.company ? (
                          <Link href={`/entreprises/${r.company.id}`} className="inline-flex items-center gap-2 hover:text-brand-600">
                            <CompanyLogo
                              name={r.company.name}
                              logoUrl={r.company.logo_url}
                              domain={r.company.website_domain}
                              size={24}
                            />
                            {r.company.name}
                            <Badge className={statusMeta(r.company.status).chip}>{statusMeta(r.company.status).label}</Badge>
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="td text-slate-500">
                        {r.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <a href={`mailto:${r.email}`} className="hover:text-brand-600">{r.email}</a>
                            {r.email_status === "devine" && (
                              <span title="Adresse reconstituée, non vérifiée"
                                className="rounded-sm bg-amber-100 px-1 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">?</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="td">
                        <Badge className={contactStatusMeta(r.status).chip}>{contactStatusMeta(r.status).label}</Badge>
                      </td>
                      <td className="td text-slate-500">{labelOf(RELATION_TYPES, r.relation_type)}</td>
                      {canWrite && (
                        <td className="td">
                          <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setOpen(true); }}>Modifier</Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <ContactModal open={open} contact={edit} companies={companies}
        onClose={() => { setOpen(false); setEdit(null); }} onSaved={load} />
    </div>
  );
}
