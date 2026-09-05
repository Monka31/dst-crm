"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Hand, Pencil, Plus, Undo2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Button, Card, EmptyState, Select, Spinner, cx } from "@/components/ui";
import { FollowUpModal, TaskModal } from "@/components/forms";
import { fmtDate, fullName } from "@/lib/format";
import type { FollowUp, Task } from "@/lib/types";

export default function TasksPage() {
  const { profile, members, canWrite } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [who, setWho] = useState("me");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "task" | "followup">(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [avancement, setAvancement] = useState<"ouvertes" | "terminees" | "toutes">("ouvertes");

  const load = useCallback(async () => {
    const [t, f, c] = await Promise.all([
      supabase.from("tasks")
        .select("*, company:companies(id,name), assignee:profiles!tasks_assigned_to_fkey(first_name,last_name)")
        .order("due_date", { nullsFirst: false }),
      supabase.from("follow_ups")
        .select("*, company:companies(id,name), assignee:profiles!follow_ups_assigned_to_fkey(first_name,last_name)")
        .eq("status", "a_faire").order("due_date"),
      supabase.from("companies").select("id,name").order("name"),
    ]);
    setTasks((t.data as unknown as Task[]) ?? []);
    setFollowUps((f.data as unknown as FollowUp[]) ?? []);
    setCompanies((c.data as { id: string; name: string }[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(["tasks", "follow_ups"], load, "tasks");

  const mine = (assigned: string | null) =>
    who === "all" ? true : who === "me" ? assigned === profile?.id : assigned === who;

  /**
   * Les tâches terminées descendent en bas de liste : une tâche barrée
   * au-dessus d'une tâche à faire n'a pas de sens quand on vient chercher
   * ce qu'il reste à faire. À statut égal, la plus urgente d'abord.
   */
  /** Le pense-bête commun : une tâche que personne ne porte encore. */
  const tachesEquipe = tasks
    .filter((t) => t.for_team && t.status !== "fait")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  const myTasks = tasks
    .filter((t) => !t.for_team)
    .filter((t) => mine(t.assigned_to))
    .filter((t) => avancement === "toutes"
      || (avancement === "ouvertes" ? t.status !== "fait" : t.status === "fait"))
    .sort((a, b) => {
      const rang = (t: Task) => (t.status === "fait" ? 1 : 0);
      if (rang(a) !== rang(b)) return rang(a) - rang(b);
      const da = a.due_date ?? "9999-12-31", db = b.due_date ?? "9999-12-31";
      return da.localeCompare(db);
    });

  const ouvertes = tasks.filter((t) => !t.for_team && mine(t.assigned_to) && t.status !== "fait").length;
  const terminees = tasks.filter((t) => !t.for_team && mine(t.assigned_to) && t.status === "fait").length;

  /** Prendre en charge : la tâche quitte la liste commune pour la mienne. */
  const prendreEnCharge = async (id: string) => {
    if (!profile) return;
    await supabase.from("tasks").update({ assigned_to: profile.id, for_team: false }).eq("id", id);
    load();
  };

  /** Et l'inverse, quand on ne peut finalement pas s'en occuper. */
  const rendreALEquipe = async (id: string) => {
    await supabase.from("tasks").update({ assigned_to: null, for_team: true }).eq("id", id);
    load();
  };
  const myFollowUps = followUps.filter((f) => mine(f.assigned_to));
  const todayStr = new Date().toISOString().slice(0, 10);

  const setTaskStatus = async (id: string, status: Task["status"]) => {
    await supabase.from("tasks").update({ status }).eq("id", id);
    load();
  };
  const setFollowUp = async (id: string, status: "fait" | "annule") => {
    await supabase.from("follow_ups").update({ status, completed_at: new Date().toISOString() }).eq("id", id);
    load();
  };
  const postpone = async (id: string, due: string) => {
    const d = new Date(due); d.setDate(d.getDate() + 3);
    await supabase.from("follow_ups").update({ due_date: d.toISOString().slice(0, 10) }).eq("id", id);
    load();
  };

  if (loading) return <Spinner className="h-6 w-6" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Mes tâches</h1>
          <p className="text-sm text-slate-500">
            {myFollowUps.length} relance(s) · {ouvertes} tâche(s) ouverte(s) · {terminees} terminée(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-auto">
            <option value="me">Moi</option>
            <option value="all">Toute l&apos;équipe</option>
            {members.filter((m) => m.role !== "viewer").map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
          </Select>
          {canWrite && <>
            <Button size="sm" variant="secondary" onClick={() => setModal("followup")}><Plus size={14} /> Relance</Button>
            <Button size="sm" onClick={() => { setEditTask(null); setModal("task"); }}><Plus size={14} /> Tâche</Button>
          </>}
        </div>
      </div>

      <Card>
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="card-title">Relances</h2>
        </div>
        {myFollowUps.length === 0 ? <EmptyState title="Aucune relance programmée" /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {myFollowUps.map((f) => {
              const late = f.due_date <= todayStr;
              return (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/entreprises/${f.company?.id}`} className="text-sm font-medium hover:text-brand-600">
                      {f.company?.name}
                    </Link>
                    <p className={cx("text-xs", late ? "font-medium text-brand-600" : "text-slate-400")}>
                      {late ? "À faire — " : "Prévue le "}{fmtDate(f.due_date)}
                      {who !== "me" && ` · ${fullName(f.assignee)}`}
                    </p>
                    {f.note && <p className="mt-0.5 text-xs text-slate-500">{f.note}</p>}
                  </div>
                  {canWrite && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="success" onClick={() => setFollowUp(f.id, "fait")}>Effectuée</Button>
                      <Button size="sm" variant="secondary" onClick={() => postpone(f.id, f.due_date)}>+3 j</Button>
                      <Button size="sm" variant="ghost" onClick={() => setFollowUp(f.id, "annule")}>Annuler</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {tachesEquipe.length > 0 && (
        <Card className="border-brand-200 dark:border-brand-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-brand-50/60 px-4 py-3 dark:border-slate-800 dark:bg-brand-950/20">
            <h2 className="card-title flex items-center gap-2">
              <Users size={15} className="text-brand-600" />
              À prendre en charge ({tachesEquipe.length})
            </h2>
            <span className="text-[11.5px] text-slate-500">
              Visible par toute l&apos;équipe tant que personne ne s&apos;en charge
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tachesEquipe.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-900 dark:text-slate-100">{t.title}</p>
                  <p className="text-xs text-slate-400">
                    {t.company && (
                      <Link href={`/entreprises/${t.company.id}`} className="hover:text-brand-600">{t.company.name}</Link>
                    )}
                    {t.due_date && `${t.company ? " · " : ""}${fmtDate(t.due_date)}`}
                  </p>
                  {t.description && <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>}
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={() => prendreEnCharge(t.id)}>
                      <Hand size={12} /> Je m&apos;en charge
                    </Button>
                    <Button size="sm" variant="secondary"
                      onClick={() => { setEditTask(t); setModal("task"); }}>
                      <Pencil size={12} /> Modifier
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="card-title">Tâches</h2>
          <div className="flex overflow-hidden rounded border border-slate-300 dark:border-slate-700">
            {([["ouvertes", `À faire (${ouvertes})`],
               ["terminees", `Terminées (${terminees})`],
               ["toutes", "Toutes"]] as const).map(([cle, libelle]) => (
              <button key={cle} onClick={() => setAvancement(cle)}
                className={cx("px-2.5 py-1 text-[12px] font-medium transition-colors",
                  avancement === cle ? "bg-brand-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300")}>
                {libelle}
              </button>
            ))}
          </div>
        </div>
        {myTasks.length === 0 ? (
          <EmptyState title={avancement === "terminees" ? "Aucune tâche terminée" : "Aucune tâche à faire"} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {myTasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <label className="flex min-w-0 items-start gap-2.5">
                  <input type="checkbox" checked={t.status === "fait"} disabled={!canWrite}
                    onChange={(e) => setTaskStatus(t.id, e.target.checked ? "fait" : "a_faire")}
                    className="mt-0.5 h-4 w-4 accent-brand-500" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cx("text-sm font-medium", t.status === "fait" && "text-slate-400 line-through")}>
                        {t.title}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-400">
                      {t.company && <Link href={`/entreprises/${t.company.id}`} className="hover:text-brand-600">{t.company.name}</Link>}
                      {t.due_date && ` · ${fmtDate(t.due_date)}`}
                      {who !== "me" && ` · ${fullName(t.assignee)}`}
                    </span>
                    {t.description && <span className="block text-xs text-slate-500">{t.description}</span>}
                  </span>
                </label>
                {canWrite && (
                  <div className="flex items-center gap-1.5">
                    {t.status !== "fait" && (
                      <Select value={t.status} onChange={(e) => setTaskStatus(t.id, e.target.value as Task["status"])} className="w-auto">
                        <option value="a_faire">À faire</option>
                        <option value="en_cours">En cours</option>
                        <option value="fait">Fait</option>
                      </Select>
                    )}
                    {t.status !== "fait" && t.assigned_to === profile?.id && (
                      <Button size="sm" variant="ghost" title="Remettre dans la liste commune"
                        onClick={() => rendreALEquipe(t.id)}>
                        <Undo2 size={12} /> Rendre à l&apos;équipe
                      </Button>
                    )}
                    <Button size="sm" variant="secondary"
                      onClick={() => { setEditTask(t); setModal("task"); }}>
                      <Pencil size={12} /> Modifier
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <TaskModal open={modal === "task"} companies={companies} task={editTask}
        onClose={() => { setModal(null); setEditTask(null); }} onSaved={load} />
      <FollowUpModal open={modal === "followup"} companies={companies} onClose={() => setModal(null)} onSaved={load} />
    </div>
  );
}
