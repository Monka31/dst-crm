"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, PhoneCall, MailCheck, ThumbsUp, ThumbsDown, CalendarCheck,
  BellRing, UserX, Clock, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Button, Card, Progress, Spinner, cx } from "@/components/ui";
import { fmtDate, fullName } from "@/lib/format";
import type { FollowUp, Stats } from "@/lib/types";

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
  /** Répartition des entreprises par secteur, les dix premiers. */
  const [bySector, setBySector] = useState<[string, number][]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [byPole, setByPole] = useState<Record<string, { total: number; contacted: number; visits: number }>>({});
  const [mine, setMine] = useState<{ companies: number; relances: number; taches: number }>({ companies: 0, relances: 0, taches: 0 });

  const load = useCallback(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [s, f, comps, myC, myR, myT] = await Promise.all([
      supabase.rpc("dashboard_stats"),
      supabase.from("follow_ups")
        .select("*, company:companies(id,name), assignee:profiles!follow_ups_assigned_to_fkey(first_name,last_name)")
        .eq("status", "a_faire").lte("due_date", todayStr).order("due_date").limit(8),
      supabase.from("companies").select("pole_id,status,sector"),
      profile ? supabase.from("companies").select("id", { count: "exact", head: true }).eq("owner_id", profile.id) : null,
      profile ? supabase.from("follow_ups").select("id", { count: "exact", head: true })
        .eq("assigned_to", profile.id).eq("status", "a_faire") : null,
      profile ? supabase.from("tasks").select("id", { count: "exact", head: true })
        .eq("assigned_to", profile.id).neq("status", "fait") : null,
    ]);

    setStats((s.data as Stats) ?? null);
    setFollowUps((f.data as unknown as FollowUp[]) ?? []);

    const agg: Record<string, { total: number; contacted: number; visits: number }> = {};
    const sec: Record<string, number> = {};
    ((comps.data as { pole_id: string | null; status: string; sector: string | null }[]) ?? []).forEach((c) => {
      const k = c.pole_id ?? "none";
      agg[k] = agg[k] ?? { total: 0, contacted: 0, visits: 0 };
      agg[k].total++;
      if (!["a_identifier", "a_contacter"].includes(c.status)) agg[k].contacted++;
      if (c.status === "visite_confirmee") agg[k].visits++;
      const nom = c.sector ?? "Non renseigné";
      sec[nom] = (sec[nom] ?? 0) + 1;
    });
    setByPole(agg);
    setBySector(Object.entries(sec).sort((a, b) => b[1] - a[1]).slice(0, 10));
    setMine({ companies: myC?.count ?? 0, relances: myR?.count ?? 0, taches: myT?.count ?? 0 });
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["companies", "interactions", "follow_ups", "tasks"], load, "dash");

  if (!stats) return <Spinner className="h-6 w-6" />;

  // Échelle des barres : le secteur le plus représenté remplit la barre.
  const maxSector = Math.max(1, ...bySector.map(([, n]) => n));
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

      <CompteARebours depart={settings?.trip_start_date} confirmees={stats.visites} objectif={objVisits} />

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

        {/* Canaux et secteurs : ce qui a été fait, et sur quel terrain. */}
        <Card className="p-5 lg:col-span-1">
          <h2 className="card-title mb-4">Canaux d&apos;activité</h2>
          <div className="grid grid-cols-2 gap-4">
            <Canal label="Emails envoyés" value={stats.emails} />
            <Canal label="Messages LinkedIn" value={stats.linkedin} />
            <Canal label="Appels" value={stats.appels} />
            <Canal label="Relances" value={stats.relances_total} />
          </div>

          <h2 className="card-title mb-3 mt-6">Entreprises par secteur</h2>
          <div className="space-y-2">
            {bySector.map(([nom, n]) => (
              <div key={nom}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="truncate text-slate-600 dark:text-slate-400">{nom}</span>
                  <span className="font-semibold">{n}</span>
                </div>
                <Progress value={n} max={maxSector} color="bg-navy-500" />
              </div>
            ))}
            {bySector.length === 0 && <p className="text-xs text-slate-400">Aucune donnée.</p>}
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

function Canal({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

/**
 * Compte à rebours avant le départ.
 *
 * Le tableau de bord disait déjà combien de visites étaient confirmées, mais
 * pas combien de temps il restait pour confirmer les autres. C'est pourtant
 * la seule question qui compte à deux mois du voyage, et personne ne fait le
 * calcul de tête en réunion.
 */
function CompteARebours({
  depart, confirmees, objectif,
}: { depart?: string | null; confirmees: number; objectif: number }) {
  if (!depart) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-500">
          La date de départ n&apos;est pas renseignée. Un administrateur peut l&apos;ajouter
          dans Paramètres pour afficher le compte à rebours.
        </p>
      </Card>
    );
  }

  // Comparaison au jour près : deux dates à midi évitent qu'un décalage
  // d'heure fasse gagner ou perdre une journée.
  const midi = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const jours = Math.round(
    (midi(new Date(depart)).getTime() - midi(new Date()).getTime()) / 86_400_000
  );

  const manquantes = Math.max(0, objectif - confirmees);
  const semaines = jours / 7;
  const parSemaine = semaines > 0 ? manquantes / semaines : 0;

  // Vert quand il reste peu à faire, rouge quand le rythme demandé devient
  // irréaliste. Le seuil est volontairement bas : une visite par semaine et
  // par pôle, c'est déjà beaucoup.
  const ton = manquantes === 0 ? "text-emerald-600"
    : parSemaine <= 2 ? "text-emerald-600"
    : parSemaine <= 5 ? "text-amber-600"
    : "text-red-600";

  const dateLisible = new Date(depart).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="label">Départ le {dateLisible}</p>
          <p className="mt-1">
            <span className={cx("font-serif text-4xl font-semibold", jours <= 14 ? "text-red-600" : "text-navy-900 dark:text-slate-50")}>
              {jours > 0 ? jours : jours === 0 ? "Aujourd'hui" : "Terminé"}
            </span>
            {jours > 0 && <span className="ml-2 text-sm text-slate-500">jour{jours > 1 ? "s" : ""} restants</span>}
          </p>
        </div>

        <div>
          <p className="label">Visites confirmées</p>
          <p className="mt-1">
            <span className="font-serif text-4xl font-semibold text-brand-700 dark:text-brand-400">{confirmees}</span>
            <span className="ml-1 text-sm text-slate-500">/ {objectif}</span>
          </p>
        </div>

        {jours > 0 && (
          <div className="min-w-[210px]">
            <p className="label">Rythme à tenir</p>
            {manquantes === 0 ? (
              <p className="mt-1 text-sm font-medium text-emerald-600">
                Objectif atteint. Tout ce qui s&apos;ajoute est du bonus.
              </p>
            ) : (
              <p className={cx("mt-1 text-sm font-medium leading-snug", ton)}>
                {manquantes} visite{manquantes > 1 ? "s" : ""} à confirmer, soit{" "}
                {parSemaine.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} par semaine
                <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                  sur les {semaines.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} semaines qui restent
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
