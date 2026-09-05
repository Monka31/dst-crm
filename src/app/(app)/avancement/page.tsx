"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Card, Progress, Spinner } from "@/components/ui";
import { fullName, initials, relative } from "@/lib/format";
import type { Activity, Stats } from "@/lib/types";

export default function ProgressPage() {
  const { settings, poles, canWrite } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [byPole, setByPole] = useState<Record<string, { total: number; contacted: number; visits: number }>>({});
  const [activity, setActivity] = useState<Activity[]>([]);

  const load = useCallback(async () => {
    // Le journal est réservé aux éditeurs : inutile de le demander pour un
    // lecteur, la requête reviendrait vide et coûterait un appel pour rien.
    const [s, comps, a] = await Promise.all([
      supabase.rpc("dashboard_stats"),
      supabase.from("companies").select("pole_id,status"),
      canWrite
        ? supabase.from("activity_log").select("*, actor:profiles(first_name,last_name)")
            .order("created_at", { ascending: false }).limit(15)
        : Promise.resolve({ data: [] as unknown }),
    ]);
    setStats((s.data as Stats) ?? null);
    setActivity((a.data as unknown as Activity[]) ?? []);
    const agg: Record<string, { total: number; contacted: number; visits: number }> = {};
    ((comps.data as { pole_id: string | null; status: string }[]) ?? []).forEach((c) => {
      const k = c.pole_id ?? "none";
      agg[k] = agg[k] ?? { total: 0, contacted: 0, visits: 0 };
      agg[k].total++;
      if (!["a_identifier", "a_contacter"].includes(c.status)) agg[k].contacted++;
      if (c.status === "visite_confirmee") agg[k].visits++;
    });
    setByPole(agg);
  }, [canWrite]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["companies", "activity_log"], load, "avancement");

  if (!stats) return <Spinner className="h-6 w-6" />;
  const obj = settings?.objective_visits ?? 35;
  const pct = Math.round((stats.visites / Math.max(1, obj)) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Avancement global</h1>
        <p className="text-sm text-slate-500">
          Digital Study Trip {settings?.trip_city ? `— ${settings.trip_city}` : ""} · tableau de pilotage en temps réel
        </p>
      </div>

      <Card className="border-navy-900 bg-navy-900 p-7 text-white dark:border-navy-800 dark:bg-navy-900">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-navy-300">Objectif global</p>
        <p className="mt-2 font-serif text-5xl font-semibold">
          {stats.visites}<span className="text-2xl font-normal text-navy-300"> / {obj} visites</span>
        </p>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-navy-800">
          <div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="mt-2 text-sm text-navy-300">{pct} % de l&apos;objectif atteint</p>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="card-title">Avancement de la prospection</h2>
        </div>
        <table className="w-full">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              ["Entreprises identifiées", stats.total],
              ["Entreprises contactées", stats.contactees],
              ["En attente de réponse", stats.en_attente],
              ["Réponses positives", stats.positives],
              ["Visites confirmées", stats.visites],
              ["Refus", stats.refus],
              ["Contacts identifiés", stats.contacts],
            ].map(([label, value]) => (
              <tr key={label as string}>
                <td className="td">{label}</td>
                <td className="td text-right text-lg font-bold">{value as number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div>
        <h2 className="label mb-3">Progression par pôle</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {poles.map((p) => {
            const d = byPole[p.id] ?? { total: 0, contacted: 0, visits: 0 };
            const target = Math.max(1, Math.round(obj / Math.max(1, poles.length)));
            const pp = Math.round((d.visits / target) * 100);
            return (
              <Card key={p.id} className="p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name}
                </p>
                <ul className="mt-2.5 space-y-0.5 text-xs text-slate-500">
                  <li>{d.total} entreprises identifiées</li>
                  <li>{d.contacted} contactées</li>
                  <li>{d.visits} visites confirmées</li>
                </ul>
                <div className="mt-3">
                  <Progress value={d.visits} max={target} color="bg-emerald-500" />
                  <p className="mt-1 text-[11px] text-slate-400">Progression : {Math.min(100, pp)} %</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {canWrite && (
      <Card>
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="card-title">Activité récente</h2>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={initials(a.actor)} size={26} />
              <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                <b>{fullName(a.actor) || "Quelqu'un"}</b> — {a.action.replace(/_/g, " ")} {a.label ? `· ${a.label}` : ""}
              </span>
              <span className="text-xs text-slate-400">{relative(a.created_at)}</span>
            </li>
          ))}
          {activity.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">Aucune activité pour l&apos;instant.</li>}
        </ul>
      </Card>
      )}
    </div>
  );
}
