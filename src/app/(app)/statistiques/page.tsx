"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Card, Progress, Spinner } from "@/components/ui";
import { STATUSES, statusMeta } from "@/lib/constants";
import { fullName, initials } from "@/lib/format";
import type { Stats } from "@/lib/types";

type MemberStat = {
  id: string; name: string; companies: number; contacts: number;
  interactions: number; visits: number; points: number;
};

export default function StatsPage() {
  const { members, settings, poles } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [bySector, setBySector] = useState<[string, number][]>([]);
  const [perMember, setPerMember] = useState<MemberStat[]>([]);

  const load = useCallback(async () => {
    const [s, comps, cts, ints] = await Promise.all([
      supabase.rpc("dashboard_stats"),
      supabase.from("companies").select("id,status,sector,owner_id,created_by"),
      supabase.from("contacts").select("id,created_by"),
      supabase.from("interactions").select("id,author_id,channel"),
    ]);
    setStats((s.data as Stats) ?? null);

    const companies = (comps.data as { id: string; status: string; sector: string | null; owner_id: string | null; created_by: string | null }[]) ?? [];
    const contacts = (cts.data as { created_by: string | null }[]) ?? [];
    const interactions = (ints.data as { author_id: string | null }[]) ?? [];

    const st: Record<string, number> = {};
    const sec: Record<string, number> = {};
    companies.forEach((c) => {
      st[c.status] = (st[c.status] ?? 0) + 1;
      const k = c.sector ?? "Non renseigné";
      sec[k] = (sec[k] ?? 0) + 1;
    });
    setByStatus(st);
    setBySector(Object.entries(sec).sort((a, b) => b[1] - a[1]).slice(0, 10));

    const ms: MemberStat[] = members
      .filter((m) => m.role !== "viewer")
      .map((m) => {
        const added = companies.filter((c) => c.created_by === m.id).length;
        const contactedCompanies = companies.filter(
          (c) => c.owner_id === m.id && !["a_identifier", "a_contacter"].includes(c.status)
        ).length;
        const visits = companies.filter((c) => c.owner_id === m.id && c.status === "visite_confirmee").length;
        const ct = contacts.filter((c) => c.created_by === m.id).length;
        const it = interactions.filter((i) => i.author_id === m.id).length;
        return {
          id: m.id, name: fullName(m), companies: added, contacts: ct,
          interactions: it, visits,
          points: added * 1 + ct * 2 + contactedCompanies * 3 + visits * 10,
        };
      })
      .sort((a, b) => b.points - a.points);
    setPerMember(ms);
  }, [members]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["companies", "contacts", "interactions"], load, "stats");

  if (!stats) return <Spinner className="h-6 w-6" />;

  const responded = stats.positives + stats.refus;
  const responseRate = stats.contactees ? Math.round((responded / stats.contactees) * 100) : 0;
  const positiveRate = responded ? Math.round((stats.positives / responded) * 100) : 0;
  const contactsPerCompany = stats.total ? (stats.contacts / stats.total).toFixed(1) : "0";
  const maxSector = Math.max(1, ...bySector.map(([, n]) => n));
  const maxPoints = Math.max(1, ...perMember.map((m) => m.points));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Statistiques</h1>
        <p className="text-sm text-slate-500">Vue d&apos;ensemble de l&apos;effort de prospection de l&apos;équipe.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Taux de réponse" value={`${responseRate} %`} hint={`${responded} réponses sur ${stats.contactees} contactées`} />
        <Stat label="Taux de réponses positives" value={`${positiveRate} %`} hint={`${stats.positives} positives / ${responded} réponses`} />
        <Stat label="Contacts par entreprise" value={contactsPerCompany} hint={`${stats.contacts} contacts identifiés`} />
        <Stat label="Interactions enregistrées" value={String(stats.interactions)} hint="tous canaux confondus" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="card-title mb-4">Répartition par statut</h2>
          <div className="space-y-2.5">
            {STATUSES.map((s) => {
              const n = byStatus[s.key] ?? 0;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">{s.label}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                  <Progress value={n} max={Math.max(1, stats.total)} color={s.dot} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="card-title mb-4">Canaux d&apos;activité</h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Emails envoyés" value={String(stats.emails)} compact />
            <Stat label="Messages LinkedIn" value={String(stats.linkedin)} compact />
            <Stat label="Appels" value={String(stats.appels)} compact />
            <Stat label="Relances" value={String(stats.relances_total)} compact />
          </div>

          <h2 className="card-title mb-3 mt-6">Entreprises par secteur</h2>
          <div className="space-y-2">
            {bySector.map(([k, n]) => (
              <div key={k}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="truncate text-slate-600 dark:text-slate-400">{k}</span>
                  <span className="font-semibold">{n}</span>
                </div>
                <Progress value={n} max={maxSector} color="bg-navy-500" />
              </div>
            ))}
            {bySector.length === 0 && <p className="text-xs text-slate-400">Aucune donnée.</p>}
          </div>
        </Card>
      </div>

      {settings?.show_member_contribution && (
      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="card-title">Contribution de chaque membre</h2>
          {settings?.gamification_enabled && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Classement activé</Badge>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="th">Membre</th>
                <th className="th">Entreprises ajoutées</th>
                <th className="th">Contacts trouvés</th>
                <th className="th">Interactions</th>
                <th className="th">Visites obtenues</th>
                {settings?.gamification_enabled && <th className="th">Points</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {perMember.map((m, i) => (
                <tr key={m.id}>
                  <td className="td">
                    <span className="inline-flex items-center gap-2">
                      {settings?.gamification_enabled && i < 3 && <span>{i + 1}</span>}
                      <Avatar name={initials({ first_name: m.name.split(" ")[0], last_name: m.name.split(" ")[1] })} size={24} />
                      <span className="font-medium">{m.name}</span>
                    </span>
                  </td>
                  <td className="td">{m.companies}</td>
                  <td className="td">{m.contacts}</td>
                  <td className="td">{m.interactions}</td>
                  <td className="td">{m.visits}</td>
                  {settings?.gamification_enabled && (
                    <td className="td">
                      <span className="inline-flex w-40 items-center gap-2">
                        <span className="font-semibold">{m.points}</span>
                        <Progress value={m.points} max={maxPoints} color="bg-amber-400" />
                      </span>
                    </td>
                  )}
                </tr>
              ))}
              {perMember.length === 0 && (
                <tr><td className="td text-slate-400" colSpan={6}>Aucun membre actif.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-[11px] text-slate-400">
          L&apos;objectif n&apos;est pas de créer une compétition, mais de rendre visible la répartition du travail.
        </p>
      </Card>
      )}
    </div>
  );
}

function Stat({ label, value, hint, compact }: { label: string; value: string; hint?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    );
  }
  return (
    <Card className="p-4">
      <p className="font-serif text-3xl font-semibold text-navy-900 dark:text-slate-50">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </Card>
  );
}
