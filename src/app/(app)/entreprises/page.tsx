"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, LayoutGrid, List, Plus, Search, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, ModalActions, Select, Spinner, cx, Textarea } from "@/components/ui";
import { CompanyModal } from "@/components/forms";
import { CompanyLogo } from "@/components/CompanyLogo";
import { PRIORITIES, STATUSES, statusMeta } from "@/lib/constants";
import { download, fullName, initials, relative, toCsv } from "@/lib/format";
import type { Company } from "@/lib/types";

const PAGE_SIZE = 25;

export default function CompaniesPage() {
  const { poles, members, canWrite, profile, isAdmin } = useApp();
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [pole, setPole] = useState("");
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState<{ col: string; asc: boolean }>({ col: "created_at", asc: false });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<"liste" | "tuiles">("liste");

  useEffect(() => {
    try {
      const v = localStorage.getItem("dst-vue-entreprises");
      if (v === "tuiles" || v === "liste") setView(v);
    } catch {}
  }, []);

  const changeView = (v: "liste" | "tuiles") => {
    setView(v);
    try { localStorage.setItem("dst-vue-entreprises", v); } catch {}
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("mine") && profile) setOwner(profile.id);
    if (p.get("status")) setStatus(p.get("status")!);
  }, [profile]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      // Seulement les colonnes affichées : la description et le motif de refus
      // pèsent à eux seuls la moitié de la charge, et la liste ne les montre pas.
      .select(
        "id,name,website,website_domain,logo_url,sector,city,status,priority,employee_count," +
        "pole_id,owner_id,last_interaction_at,created_at," +
        "pole:poles(id,name,color), owner:profiles!companies_owner_id_fkey(id,first_name,last_name), contacts(count)"
      )
      .order("created_at", { ascending: false });
    setRows((data as unknown as Company[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(["companies", "contacts"], load, "companies");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (pole && r.pole_id !== pole) return false;
      if (owner && r.owner_id !== owner) return false;
      if (priority && r.priority !== priority) return false;
      if (term) {
        const hay = `${r.name} ${r.city ?? ""} ${r.sector ?? ""} ${r.website ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const dir = sort.asc ? 1 : -1;
      const get = (r: Company) => {
        switch (sort.col) {
          case "name": return r.name.toLowerCase();
          case "status": return STATUSES.findIndex((s) => s.key === r.status);
          case "city": return (r.city ?? "").toLowerCase();
          case "sector": return (r.sector ?? "").toLowerCase();
          case "owner": return fullName(r.owner).toLowerCase();
          case "last": return r.last_interaction_at ?? "";
          default: return r.created_at;
        }
      };
      const va = get(a), vb = get(b);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return out;
  }, [rows, q, status, pole, owner, priority, sort]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(0); }, [q, status, pole, owner, priority]);

  const quickUpdate = async (id: string, patch: Partial<Company>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as Company : r)));
    await supabase.from("companies").update(patch).eq("id", id);
    load();
  };

  const bulkUpdate = async (patch: Record<string, unknown>) => {
    const ids = [...selected];
    if (!ids.length) return;
    await supabase.from("companies").update(patch).in("id", ids);
    setSelected(new Set());
    load();
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length || !confirm(`Supprimer ${ids.length} entreprise(s) ? Cette action est irréversible.`)) return;
    await supabase.from("companies").delete().in("id", ids);
    setSelected(new Set());
    load();
  };

  /** L'export va chercher les colonnes complètes : elles ne sont pas chargées
      en permanence, seulement au moment où quelqu'un demande le fichier. */
  const exportCsv = async () => {
    const { data } = await supabase
      .from("companies")
      .select("*, pole:poles(name), owner:profiles!companies_owner_id_fkey(first_name,last_name), contacts(count)")
      .in("id", filtered.map((r) => r.id));
    const complet = (data as unknown as Company[]) ?? [];
    download("entreprises-dst.csv", toCsv(complet.map((r) => ({
      Nom: r.name, Site: r.website ?? "", Secteur: r.sector ?? "", "Sous-secteur": r.subsector ?? "",
      Effectif: r.employee_count ?? "", "Chiffre d'affaires": r.revenue ?? "",
      Ville: r.city ?? "",
      Pays: r.country ?? "", Statut: statusMeta(r.status).label, Priorité: r.priority,
      Pôle: r.pole?.name ?? "", Responsable: fullName(r.owner), Contacts: r.contacts?.[0]?.count ?? 0,
      "Dernière interaction": r.last_interaction_at ?? "", "Prochaine action": r.next_action ?? "",
      Description: r.description ?? "", "Motif de refus": r.refusal_reason ?? "",
    }))));
  };

  const resetFilters = () => { setQ(""); setStatus(""); setPole(""); setOwner(""); setPriority(""); };
  const anyFilter = q || status || pole || owner || priority;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Entreprises</h1>
          <p className="text-sm text-slate-500">{filtered.length} entreprise{filtered.length > 1 ? "s" : ""} · {rows.length} au total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
          {canWrite && <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}><Upload size={14} /> Import</Button>}
          {canWrite && <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Ajouter</Button>}
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-8" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Tous les statuts</option>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <Select value={pole} onChange={(e) => setPole(e.target.value)} className="w-auto min-w-[130px]">
            <option value="">Tous les pôles</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Tous les responsables</option>
            {profile && <option value={profile.id}>Mes entreprises</option>}
            {members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto min-w-[120px]">
            <option value="">Priorité</option>
            {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </Select>
          {anyFilter && (
            <Button variant="ghost" size="sm" onClick={resetFilters}><X size={14} /> Réinitialiser</Button>
          )}

          <div className="ml-auto flex overflow-hidden rounded border border-slate-300 dark:border-slate-700">
            {([["liste", "Liste", List], ["tuiles", "Tuiles", LayoutGrid]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => changeView(key)} title={label}
                className={cx(
                  "flex items-center gap-1.5 px-2.5 py-2 text-[12px] font-semibold transition-colors",
                  view === key
                    ? "bg-brand-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"
                )}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        {selected.size > 0 && canWrite && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <span className="text-xs font-medium">{selected.size} sélectionnée(s)</span>
            <Select className="w-auto" onChange={(e) => e.target.value && bulkUpdate({ status: e.target.value })} value="">
              <option value="">Changer le statut…</option>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
            <Select className="w-auto" onChange={(e) => e.target.value && bulkUpdate({ owner_id: e.target.value })} value="">
              <option value="">Attribuer à…</option>
              {members.filter((m) => m.role !== "viewer").map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </Select>
            <Select className="w-auto" onChange={(e) => e.target.value && bulkUpdate({ pole_id: e.target.value })} value="">
              <option value="">Déplacer vers le pôle…</option>
              {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            {isAdmin && <Button size="sm" variant="danger" onClick={bulkDelete}>Supprimer</Button>}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Annuler</Button>
          </div>
        )}
      </Card>

      {loading ? (
        <Card className="p-8"><Spinner /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="Aucune entreprise"
            hint={anyFilter ? "Aucun résultat pour ces filtres." : "Commencez par ajouter une entreprise."}
            action={canWrite && !anyFilter ? <Button size="sm" className="mt-3" onClick={() => setAddOpen(true)}><Plus size={14} /> Ajouter</Button> : undefined} />
        </Card>
      ) : view === "tuiles" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageRows.map((r) => (
            <Card key={r.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
              <Link href={`/entreprises/${r.id}`}>
                <CompanyLogo variant="bandeau" name={r.name} logoUrl={r.logo_url} domain={r.website_domain} />
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <div>
                  <Link href={`/entreprises/${r.id}`}
                    className="block truncate text-sm font-semibold text-navy-900 hover:text-brand-700 dark:text-slate-100">
                    {r.name}
                  </Link>
                  <p className="truncate text-[11.5px] text-slate-500">
                    {[r.sector, r.city].filter(Boolean).join(" · ") || "Secteur à renseigner"}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <Badge className={statusMeta(r.status).chip}>{statusMeta(r.status).label}</Badge>
                  {r.owner
                    ? <span title={fullName(r.owner)}><Avatar name={initials(r.owner)} size={22} /></span>
                    : <span className="text-[10.5px] text-slate-400">non attribuée</span>}
                </div>
                <p className="text-[11px] text-slate-400">
                  {r.employee_count ? `${r.employee_count} salariés · ` : ""}
                  {r.contacts?.[0]?.count ?? 0} contact(s)
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
<div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  {canWrite && (
                    <th className="th w-9">
                      <input type="checkbox" className="h-3.5 w-3.5 accent-brand-500"
                        checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                        onChange={(e) => {
                          const n = new Set(selected);
                          pageRows.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id)));
                          setSelected(n);
                        }} />
                    </th>
                  )}
                  <Th col="name" sort={sort} setSort={setSort}>Nom</Th>
                  <Th col="sector" sort={sort} setSort={setSort}>Secteur</Th>
                  <Th col="city" sort={sort} setSort={setSort}>Ville</Th>
                  <Th col="status" sort={sort} setSort={setSort}>Statut</Th>
                  <th className="th">Contacts</th>
                  <Th col="owner" sort={sort} setSort={setSort}>Responsable</Th>
                  <Th col="last" sort={sort} setSort={setSort}>Dernière interaction</Th>
                  <th className="th">Pôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((r) => (
                  <tr key={r.id} className="row-hover">
                    {canWrite && (
                      <td className="td">
                        <input type="checkbox" className="h-3.5 w-3.5 accent-brand-500"
                          checked={selected.has(r.id)}
                          onChange={(e) => {
                            const n = new Set(selected);
                            e.target.checked ? n.add(r.id) : n.delete(r.id);
                            setSelected(n);
                          }} />
                      </td>
                    )}
                    <td className="td">
                      <span className="flex items-center gap-2.5">
                        <CompanyLogo name={r.name} logoUrl={r.logo_url} domain={r.website_domain} size={28} />
                        <Link href={`/entreprises/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700 dark:text-slate-100">
                          {r.name}
                        </Link>
                      </span>
                      {r.priority === "haute" && <Badge className="ml-9 bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300">Prioritaire</Badge>}
                      {r.website && <p className="ml-9 text-[11px] text-slate-400">{r.website_domain}</p>}
                    </td>
                    <td className="td text-slate-500">{r.sector ?? "—"}</td>
                    <td className="td text-slate-500">{r.city ?? "—"}</td>
                    <td className="td">
                      {canWrite ? (
                        <select value={r.status} onChange={(e) => quickUpdate(r.id, { status: e.target.value })}
                          className={cx("cursor-pointer rounded-full border-0 px-2 py-1 text-[11px] font-medium outline-none", statusMeta(r.status).chip)}>
                          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      ) : (
                        <Badge className={statusMeta(r.status).chip}>{statusMeta(r.status).label}</Badge>
                      )}
                    </td>
                    <td className="td text-center text-slate-500">{r.contacts?.[0]?.count ?? 0}</td>
                    <td className="td">
                      {canWrite ? (
                        <select value={r.owner_id ?? ""} onChange={(e) => quickUpdate(r.id, { owner_id: e.target.value || null } as Partial<Company>)}
                          className="cursor-pointer rounded-md border-0 bg-transparent py-1 text-xs outline-none dark:bg-transparent">
                          <option value="">Non attribuée</option>
                          {members.filter((m) => m.role !== "viewer").map((m) => (
                            <option key={m.id} value={m.id}>{fullName(m)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs">{fullName(r.owner) || "—"}</span>
                      )}
                    </td>
                    <td className="td text-xs text-slate-500">{relative(r.last_interaction_at)}</td>
                    <td className="td">
                      {r.pole ? (
                        <Badge className="border" ><span className="h-2 w-2 rounded-full" style={{ background: r.pole.color }} />{r.pole.name}</Badge>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <Card className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="text-slate-500">Page {page + 1} / {pages} · {filtered.length} entreprise(s)</span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button>
            <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        </Card>
      )}

      <CompanyModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => load()} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  );
}

function Th({ col, sort, setSort, children }: {
  col: string; sort: { col: string; asc: boolean }; setSort: (s: { col: string; asc: boolean }) => void; children: React.ReactNode;
}) {
  const active = sort.col === col;
  return (
    <th className="th">
      <button onClick={() => setSort({ col, asc: active ? !sort.asc : true })}
        className={cx("inline-flex items-center gap-1", active && "text-brand-600")}>
        {children}{active && <span>{sort.asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

/* -------------------- Import CSV -------------------- */

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { profile, poles } = useApp();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [pole, setPole] = useState("");

  const parse = () => {
    const lines = raw.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { setPreview([]); return; }
    const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    const out = lines.slice(1).map((l) => {
      const cells = l.split(sep);
      const o: Record<string, string> = {};
      headers.forEach((h, i) => (o[h] = (cells[i] ?? "").trim()));
      return o;
    });
    setPreview(out.slice(0, 200));
  };

  const pick = (r: Record<string, string>, keys: string[]) => {
    for (const k of keys) if (r[k]) return r[k];
    return "";
  };

  const run = async () => {
    setBusy(true);
    let inserted = 0, skipped = 0;
    for (const r of preview) {
      const name = pick(r, ["nom", "name", "entreprise", "company"]);
      if (!name) { skipped++; continue; }
      const website = pick(r, ["site", "site internet", "website", "url"]);
      const { data: dup } = await supabase.rpc("find_duplicates", { p_name: name, p_website: website || null });
      if ((dup as unknown[])?.length) { skipped++; continue; }
      const { error } = await supabase.from("companies").insert({
        name,
        website: website || null,
        sector: pick(r, ["secteur", "sector"]) || null,
        city: pick(r, ["ville", "city"]) || null,
        country: pick(r, ["pays", "country"]) || null,
        linkedin_url: pick(r, ["linkedin"]) || null,
        description: pick(r, ["description"]) || null,
        pole_id: pole || null,
        created_by: profile?.id,
      });
      if (error) skipped++; else inserted++;
    }
    setBusy(false);
    setResult(`${inserted} entreprise(s) importée(s), ${skipped} ignorée(s) (doublons ou nom manquant).`);
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title="Importer des entreprises" wide>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Collez vos données CSV (ou copiez-collez directement depuis Excel). La première ligne doit contenir les
          en-têtes : <code>nom</code>, <code>site</code>, <code>secteur</code>, <code>ville</code>, <code>pays</code>, <code>linkedin</code>, <code>description</code>.
          Les doublons sont détectés et ignorés automatiquement.
        </p>
        <Textarea rows={8} value={raw} onChange={(e) => setRaw(e.target.value)}
          placeholder={"nom;site;secteur;ville\nSpotify;spotify.com;Tech & Digital;Londres"} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <Select value={pole} onChange={(e) => setPole(e.target.value)}>
              <option value="">Sans pôle</option>
              {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <Button variant="secondary" onClick={parse}>Analyser</Button>
          {preview.length > 0 && <Button onClick={run} disabled={busy}>{busy ? <Spinner /> : `Importer ${preview.length} ligne(s)`}</Button>}
        </div>
        {preview.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs dark:border-slate-800">
            <table className="w-full">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.slice(0, 10).map((r, i) => (
                  <tr key={i}><td className="td">{Object.values(r).join(" · ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{result}</p>}
      </div>
    </Modal>
  );
}
