"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Badge, Card, Select, Spinner, cx } from "@/components/ui";
import { STATUSES, statusMeta } from "@/lib/constants";
import { fullName, initials, relative } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { Company } from "@/lib/types";

export default function KanbanPage() {
  const { poles, members, profile, canWrite } = useApp();
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [pole, setPole] = useState("");
  const [owner, setOwner] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("*, pole:poles(id,name,color), owner:profiles!companies_owner_id_fkey(id,first_name,last_name)")
      .order("updated_at", { ascending: false });
    setRows((data as unknown as Company[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(["companies"], load, "kanban");

  const filtered = useMemo(
    () => rows.filter((r) => (!pole || r.pole_id === pole) && (!owner || r.owner_id === owner)),
    [rows, pole, owner]
  );

  const move = async (id: string, status: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.status === status) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("companies").update({ status }).eq("id", id);
    if (error) { alert("Modification refusée : " + error.message); }
    load();
  };

  if (loading) return <Spinner className="h-6 w-6" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Prospection</h1>
          <p className="text-sm text-slate-500">
            {canWrite ? "Glissez une carte pour changer son statut — l'historique est mis à jour automatiquement."
              : "Vue en lecture seule."}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={pole} onChange={(e) => setPole(e.target.value)} className="w-auto">
            <option value="">Tous les pôles</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-auto">
            <option value="">Tous les responsables</option>
            {profile && <option value={profile.id}>Mes entreprises</option>}
            {members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
          </Select>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((s) => {
          const items = filtered.filter((r) => r.status === s.key);
          return (
            <div key={s.key}
              onDragOver={(e) => { if (canWrite) { e.preventDefault(); setOverCol(s.key); } }}
              onDragLeave={() => setOverCol(null)}
              onDrop={(e) => {
                e.preventDefault(); setOverCol(null);
                if (dragId && canWrite) move(dragId, s.key);
                setDragId(null);
              }}
              className={cx(
                "flex w-64 shrink-0 flex-col rounded-xl border-t-4 bg-slate-100/70 p-2 transition dark:bg-slate-900/60",
                s.kanban, overCol === s.key && "ring-2 ring-brand-300"
              )}>
              <div className="flex items-center justify-between px-1.5 py-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className={cx("h-2 w-2 rounded-full", s.dot)} />{s.label}
                </span>
                <span className="rounded-full bg-white px-1.5 text-[11px] text-slate-500 dark:bg-slate-800">{items.length}</span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
                {items.map((r) => (
                  <div key={r.id}
                    draggable={canWrite}
                    onDragStart={() => setDragId(r.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cx(
                      "rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition dark:border-slate-800 dark:bg-slate-900",
                      canWrite && "cursor-grab active:cursor-grabbing hover:shadow-md",
                      dragId === r.id && "opacity-40"
                    )}>
                    <span className="flex items-center gap-2">
                      <CompanyLogo name={r.name} logoUrl={r.logo_url} domain={r.website_domain} size={22} />
                      <Link href={`/entreprises/${r.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-brand-700">
                        {r.name}
                      </Link>
                    </span>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {[r.sector, r.city].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{relative(r.last_interaction_at)}</span>
                      {r.owner ? <Avatar name={initials(r.owner)} size={20} /> :
                        <span className="text-[10px] text-slate-300">non attribuée</span>}
                    </div>
                    {r.pole && (
                      <Badge className="mt-1.5 bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.pole.color }} />{r.pole.name}
                      </Badge>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-[11px] text-slate-400 dark:border-slate-700">
                    Vide
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
