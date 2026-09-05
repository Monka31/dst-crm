"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, PhoneCall, MailCheck, ThumbsUp, ThumbsDown, CalendarCheck,
  BellRing, UserX, Clock, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Button, Card, Progress, Spinner, cx } from "@/components/ui";
import { statusMeta } from "@/lib/constants";
import { fmtDate, fullName, initials, relative } from "@/lib/format";
import type { Activity, FollowUp, Stats } from "@/lib/types";

const KPI = [
  { key: "total", label: "Entreprises identifiées", icon: Building2, tone: "text-slate-500" },
  { key: "a_contacter", label: "À contacter", icon: PhoneCall, tone: "text-sky-500" },
  { key: "contactees", label: "Contactées", icon: MailCheck, tone: "text-violet-500" },
  { key: "positives", label: "Réponses positives", icon: ThumbsUp, tone: "text-emerald-500" },
  { key: "refus", label: "Refus", icon: ThumbsDown, tone: "text-red-500" },
  { key: "visites", label: "Visites confirmées", icon: CalendarCheck, tone: "text-green-600" },
  { key: "relances_du_jour", label: "Relances à faire", icon: BellRing, tone: "text-amber-500" },
  { key: "sans_contact", label: "Sans interlocuteur", icon: UserX, tone: "text-orange-500" },
  { key: "sans_activite", label: "Sans activité récente", icon: Clock, tone: "text-slate-400" },
] as const;

export default function DashboardPage() {
  const { profile, settings, poles, canWrite } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [byPole, setByPole] = useState<Record<string, { total: number; contacted: number; visits: number }>>({});
  const [mine, setMine] = useState<{ companies: number; relances: number; taches: number }>({ companies: 0, relances: 0, taches: 0 });

  const load = useCallback(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [s, a, f, comps, myC, myR, myT] = await Promise.all([
      supabase.rpc("dashboard_stats"),
      supabase.from("activity_log")
        .select("*, actor:profiles(first_name,last_name)")
        .order("created_at", { ascending: false }).limit(12),
      supabase.from("follow_ups")
        .select("*, company:companies(id,name), assignee:profiles!follow_ups_assigned_to_fkey(first_name,last_name)")
        .eq("status", "a_faire").lte("due_date", todayStr).order("due_date").limit(8),
      supabase.from("companies").select("pole_id,status"),
      profile ? supabase.from("companies").select("id", { count: "exact", head: true }).eq("owner_id", profile.id) : null,
      profile ? supabase.from("follow_ups").select("id", { count: "exact", head: true })
        .eq("assigned_to", profile.id).eq("status", "a_faire") : null,
      profile ? supabase.from("tasks").select("id", { count: "exact", head: true })
        .eq("assigned_to", profile.id).neq("status", "fait") : null,
    ]);

    setStats((s.data as Stats) ?? null);
    setActivity((a.data as Activity[]) ?? []);
    setFollowUps((f.data as unknown as FollowUp[]) ?? []);

    const agg: Record<string, { total: number; contacted: number; visits: number }> = {};
    ((comps.data as { pole_id: string | null; status: string }[]) ?? []).forEach((c) => {
      const k = c.pole_id ?? "none";
      agg[k] = agg[k] ?? { total: 0, contacted: 0, visits: 0 };
      agg[k].total++;
      if (!["a_identifier", "a_contacter"].includes(c.status)) agg[k].contacted++;
      if (c.status === "visite_confirmee") agg[k].visits++;
    });
    setByPole(agg);
    setMine({ companies: myC?.count ?? 0, relances: myR?.count ?? 0, taches: myT?.count ?? 0 });
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["companies", "interactions", "follow_ups", "activity_log", "tasks"], load, "dash");

  if (!stats) return <Spinner className="h-6 w-6" />;

  const objVisits = settings?.objective_visits ?? 35;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Bonjour {profile?.first_name}</h1>
          <p className="text-sm text-slate-500">
            Study Trip {settings?.trip_city ?? "—"} · objectif {objVisits} visites
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2 text-sm">
            <Link href="/entreprises?mine=1"><Button variant="secondary" size="sm">{mine.companies} entreprises à moi</Button></Link>
            <Link href="/taches"><Button variant="secondary" size="sm">{mine.relances} relances · {mine.taches} tâches</Button></Link>
          </div>
        )}
      </div>

      {/* Progression */}
      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="label">Progression vers l&apos;objectif</h2>
          <span className="font-serif text-2xl font-semibold text-brand-700 dark:text-brand-400">{stats.visites}<span className="text-base text-slate-400"> / {objVisits} visites</span></span>
        </div>
        <Progress value={stats.visites} max={objVisits} color="bg-brand-500" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <MiniGoal label="Entreprises identifiées" value={stats.total} max={settings?.objective_companies ?? 350} color="bg-navy-500" />
          <MiniGoal label="Contacts trouvés" value={stats.contacts} max={settings?.objective_contacts ?? 300} color="bg-violet-500" />
          <MiniGoal label="Entreprises contactées" value={stats.contactees} max={settings?.objective_contacted ?? 250} color="bg-sky-500" />
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KPI.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.key} className="p-4">
              <div className="flex items-center justify-between">
                <Icon size={16} className={k.tone} />
                <span className="text-2xl font-bold">{stats[k.key as keyof Stats]}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{k.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Relances */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="card-title">Relances à effectuer</h2>
            <Link href="/taches" className="text-xs text-brand-600 hover:underline">Tout voir</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {followUps.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune relance en retard.</p>}
            {followUps.map((f) => (
              <Link key={f.id} href={`/entreprises/${f.company?.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.company?.name}</p>
                  <p className="text-xs text-slate-400">{fmtDate(f.due_date)} · {fullName(f.assignee) || "non assignée"}</p>
                </div>
                <ArrowRight size={14} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Progression par pôle */}
        <Card className="lg:col-span-1">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="card-title">Progression par pôle</h2>
          </div>
          <div className="space-y-4 p-4">
            {poles.map((p) => {
              const d = byPole[p.id] ?? { total: 0, contacted: 0, visits: 0 };
              const target = Math.max(1, Math.round(objVisits / Math.max(1, poles.length)));
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}
                    </span>
                    <span className="text-xs text-slate-400">{d.visits} / {target} visites</span>
                  </div>
                  <Progress value={d.visits} max={target} color="bg-emerald-500" />
                  <p className="mt-1 text-[11px] text-slate-400">
                    {d.total} identifiées · {d.contacted} contactées
                  </p>
                </div>
              );
            })}
            {poles.length === 0 && <p className="text-sm text-slate-400">Aucun pôle créé.</p>}
          </div>
        </Card>

        {/* Activité */}
        <Card className="lg:col-span-1">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="card-title">Activité de l&apos;équipe</h2>
          </div>
          <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
            {activity.length === 0 && <p className="text-sm text-slate-400">Rien encore. Ajoutez votre première entreprise.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2.5">
                <Avatar name={initials(a.actor)} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-slate-700 dark:text-slate-300">
                    <b>{fullName(a.actor) || "Quelqu'un"}</b> {describe(a)}
                  </p>
                  <p className="text-[10px] text-slate-400">{relative(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MiniGoal({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-semibold">{value} / {max}</span>
      </div>
      <Progress value={value} max={max} color={color} />
    </div>
  );
}

function describe(a: Activity) {
  const label = a.label ?? "";
  switch (a.action) {
    case "company_created": return <>a ajouté <b>{label}</b></>;
    case "status_changed": return <>a changé un statut — {prettyStatus(label)}</>;
    case "owner_changed": return <>s&apos;est vu attribuer <b>{label}</b></>;
    case "contact_added": return <>a ajouté le contact <b>{label}</b></>;
    case "interaction_added": return <>a enregistré une interaction ({label})</>;
    case "visit_created": return <>a créé une visite ({label})</>;
    case "visit_updated": return <>a mis à jour une visite ({label})</>;
    default: return <>{a.action}</>;
  }
}

function prettyStatus(label: string) {
  const m = label.match(/^(.*) : (.*) -> (.*)$/);
  if (!m) return label;
  return (
    <>
      <b>{m[1]}</b>{" "}
      <Badge className={cx(statusMeta(m[2]).chip, "mx-0.5")}>{statusMeta(m[2]).label}</Badge>→
      <Badge className={cx(statusMeta(m[3]).chip, "mx-0.5")}>{statusMeta(m[3]).label}</Badge>
    </>
  );
}
