"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const { settings, poles, refreshRefs, isAdmin } = useApp();
  const [f, setF] = useState<Partial<Settings>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newPole, setNewPole] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  useEffect(() => { if (settings) setF(settings); }, [settings]);

  if (!isAdmin) {
    return <Card className="p-8 text-center text-sm text-slate-500">Réservé aux administrateurs.</Card>;
  }
  if (!settings) return <Spinner className="h-6 w-6" />;

  const set = (k: keyof Settings, v: string | number | boolean) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("settings").update({
      trip_city: f.trip_city, trip_country: f.trip_country,
      trip_start_date: f.trip_start_date || null, trip_end_date: f.trip_end_date || null,
      objective_visits: Number(f.objective_visits), objective_companies: Number(f.objective_companies),
      objective_contacted: Number(f.objective_contacted), objective_contacts: Number(f.objective_contacts),
      follow_up_delay_days: Number(f.follow_up_delay_days), stale_days: Number(f.stale_days),
      gamification_enabled: !!f.gamification_enabled,
      show_member_contribution: !!f.show_member_contribution,
      show_inactivity: !!f.show_inactivity,
    }).eq("id", true);
    setBusy(false);
    if (error) { alert(error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    await refreshRefs();
  };

  const addPole = async () => {
    if (!newPole.trim()) return;
    const { error } = await supabase.from("poles").insert({ name: newPole.trim(), color: newColor });
    if (error) { alert(error.message); return; }
    setNewPole(""); await refreshRefs();
  };

  const delPole = async (id: string, name: string) => {
    if (!confirm(`Supprimer le pôle « ${name} » ? Les entreprises rattachées ne seront pas supprimées.`)) return;
    const { error } = await supabase.from("poles").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    await refreshRefs();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="page-title">Paramètres</h1>
        <p className="text-sm text-slate-500">Objectifs du Study Trip, pôles et règles de relance.</p>
      </div>

      <Card className="p-5">
        <h2 className="card-title mb-4">Le voyage</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ville"><Input value={f.trip_city ?? ""} onChange={(e) => set("trip_city", e.target.value)} /></Field>
          <Field label="Pays"><Input value={f.trip_country ?? ""} onChange={(e) => set("trip_country", e.target.value)} /></Field>
          <Field label="Date de début"><Input type="date" value={f.trip_start_date ?? ""} onChange={(e) => set("trip_start_date", e.target.value)} /></Field>
          <Field label="Date de fin"><Input type="date" value={f.trip_end_date ?? ""} onChange={(e) => set("trip_end_date", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="card-title mb-4">Objectifs</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Visites"><Input type="number" value={f.objective_visits ?? 0} onChange={(e) => set("objective_visits", e.target.value)} /></Field>
          <Field label="Entreprises identifiées"><Input type="number" value={f.objective_companies ?? 0} onChange={(e) => set("objective_companies", e.target.value)} /></Field>
          <Field label="Entreprises contactées"><Input type="number" value={f.objective_contacted ?? 0} onChange={(e) => set("objective_contacted", e.target.value)} /></Field>
          <Field label="Contacts trouvés"><Input type="number" value={f.objective_contacts ?? 0} onChange={(e) => set("objective_contacts", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="card-title mb-4">Règles</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Délai de relance (jours)" hint="Relance proposée automatiquement après chaque email ou message.">
            <Input type="number" value={f.follow_up_delay_days ?? 7} onChange={(e) => set("follow_up_delay_days", e.target.value)} />
          </Field>
          <Field label="Seuil « sans activité » (jours)">
            <Input type="number" value={f.stale_days ?? 14} onChange={(e) => set("stale_days", e.target.value)} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={!!f.gamification_enabled}
            onChange={(e) => set("gamification_enabled", e.target.checked)}
            className="h-4 w-4 accent-brand-500" />
          Activer la gamification (points et classement dans les statistiques)
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={!!f.show_member_contribution}
            onChange={(e) => set("show_member_contribution", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500" />
          <span>
            Afficher le tableau « Contribution de chaque membre » dans les statistiques
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
              Masqué par défaut : ce tableau détaille l&apos;activité de chacun.
            </span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={!!f.show_inactivity}
            onChange={(e) => set("show_inactivity", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500" />
          <span>
            Signaler dans le Résumé les membres sans activité enregistrée
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
              Masqué par défaut. À douze personnes qui se connaissent, ce genre de liste
              crispe souvent plus qu&apos;il ne motive — et un appel passé sans être noté
              ne laisse aucune trace.
            </span>
          </span>
        </label>
      </Card>

      <Card className="p-5">
        <h2 className="card-title mb-4">Pôles / Tracks</h2>
        <ul className="mb-4 space-y-2">
          {poles.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
              <span className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />{p.name}
              </span>
              <Button size="sm" variant="ghost" onClick={() => delPole(p.id, p.name)}><Trash2 size={13} /></Button>
            </li>
          ))}
          {poles.length === 0 && <p className="text-xs text-slate-400">Aucun pôle.</p>}
        </ul>
        <div className="flex gap-2">
          <Input value={newPole} onChange={(e) => setNewPole(e.target.value)} placeholder="Nom du pôle" />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700" />
          <Button onClick={addPole}><Plus size={14} /> Ajouter</Button>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? <Spinner /> : "Enregistrer"}</Button>
        {saved && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
      </div>
    </div>
  );
}
