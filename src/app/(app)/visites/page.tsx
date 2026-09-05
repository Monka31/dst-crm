"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarPlus, Check, Download, List as ListIcon, Printer, Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Badge, Button, Card, EmptyState, Select, Spinner } from "@/components/ui";
import { VisitModal } from "@/components/forms";
import { Calendrier, type VisitRow } from "@/components/CalendrierVisites";
import { download, fmtDate, fullName, initials, toCsv } from "@/lib/format";
import { versIcs } from "@/lib/agenda";
import { Avatar } from "@/components/ui";


export default function VisitsPage() {
  const { canWrite, isStaff, poles, settings, profile } = useApp();
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [pole, setPole] = useState("");
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<VisitRow | null>(null);
  const [view, setView] = useState<"liste" | "calendrier">("liste");
  const [month, setMonth] = useState<string>("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Record<string, { profile_id: string; first_name: string; last_name: string }[]>>({});
  const [inscription, setInscription] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("dst-vue-visites");
      if (v === "liste" || v === "calendrier") setView(v);
    } catch {}
  }, []);

  const changeView = (v: "liste" | "calendrier") => {
    setView(v);
    try { localStorage.setItem("dst-vue-visites", v); } catch {}
  };

  const load = useCallback(async () => {
    const [v, c, p] = await Promise.all([
      supabase.from("visits")
        .select("*, company:companies(id,name,city), pole:poles(name,color), owner:profiles!visits_owner_id_fkey(first_name,last_name)")
        .order("visit_date", { nullsFirst: false }),
      supabase.from("companies").select("id,name").in("status", ["positif", "visite_confirmee"]).order("name"),
      supabase.from("visit_participants").select("visit_id, profile:profiles(id,first_name,last_name)"),
    ]);
    setRows((v.data as unknown as VisitRow[]) ?? []);
    setCompanies((c.data as { id: string; name: string }[]) ?? []);

    const parVisite: Record<string, { profile_id: string; first_name: string; last_name: string }[]> = {};
    ((p.data as unknown as { visit_id: string; profile: { id: string; first_name: string; last_name: string } | null }[]) ?? [])
      .forEach((x) => {
        if (!x.profile) return;
        (parVisite[x.visit_id] ??= []).push({
          profile_id: x.profile.id, first_name: x.profile.first_name, last_name: x.profile.last_name,
        });
      });
    setParticipants(parVisite);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(["visits", "visit_participants"], load, "visits");

  useEffect(() => {
    if (month) return;
    const ref = settings?.trip_start_date
      ?? rows.find((r) => r.visit_date)?.visit_date
      ?? new Date().toISOString();
    setMonth(ref.slice(0, 7));
  }, [settings, rows, month]);

  const filtered = useMemo(
    () => rows.filter((r) => (!filter || r.confirmation === filter) && (!pole || r.pole_id === pole)),
    [rows, filter, pole]
  );

  const byDay = useMemo(() => {
    const m = new Map<string, VisitRow[]>();
    filtered.forEach((r) => {
      const k = r.visit_date ?? "Sans date";
      m.set(k, [...(m.get(k) ?? []), r]);
    });
    return [...m.entries()].sort((a, b) => (a[0] === "Sans date" ? 1 : b[0] === "Sans date" ? -1 : a[0].localeCompare(b[0])));
  }, [filtered]);

  const conflicts = useMemo(() => {
    const out: string[] = [];
    const dated = filtered.filter((r) => r.visit_date && r.confirmation !== "annulee");
    for (let i = 0; i < dated.length; i++) {
      for (let j = i + 1; j < dated.length; j++) {
        const a = dated[i], b = dated[j];
        if (a.visit_date !== b.visit_date) continue;
        if (a.start_time && b.start_time && a.end_time && b.end_time) {
          if (a.start_time < b.end_time && b.start_time < a.end_time) {
            out.push(`${fmtDate(a.visit_date)} : ${a.company?.name} et ${b.company?.name} se chevauchent.`);
          }
        }
        if (a.owner_id && a.owner_id === b.owner_id) {
          out.push(`${fmtDate(a.visit_date)} : ${fullName(a.owner)} est responsable de deux visites (${a.company?.name}, ${b.company?.name}).`);
        }
      }
    }
    const seen = new Set<string>();
    filtered.forEach((r) => {
      if (!r.company_id) return;
      if (seen.has(r.company_id)) out.push(`${r.company?.name} est planifiée deux fois.`);
      seen.add(r.company_id);
    });
    filtered.forEach((r) => {
      if (r.start_time && r.end_time && r.end_time <= r.start_time) {
        out.push(`${r.company?.name} : horaires incohérents (${r.start_time} → ${r.end_time}).`);
      }
    });
    return [...new Set(out)];
  }, [filtered]);

  /** Inscription à une visite : chacun s'inscrit et se désinscrit lui-même. */
  const basculerInscription = async (visiteId: string, inscrit: boolean) => {
    if (!profile) return;
    setInscription(visiteId);
    if (inscrit) {
      await supabase.from("visit_participants").delete()
        .eq("visit_id", visiteId).eq("profile_id", profile.id);
    } else {
      await supabase.from("visit_participants").insert({ visit_id: visiteId, profile_id: profile.id });
    }
    setInscription(null);
    load();
  };

  const exporterAgenda = () => {
    const evenements = filtered.filter((r) => r.visit_date && r.confirmation !== "annulee").map((r) => ({
      id: r.id,
      titre: `Visite ${r.company?.name ?? "entreprise"}`,
      date: r.visit_date,
      debut: r.start_time,
      fin: r.end_time,
      lieu: r.address ?? r.company?.city ?? null,
      description: [
        r.speaker ? `Intervenant : ${r.speaker}` : null,
        r.contact_email ? `Contact : ${r.contact_email}` : null,
        r.language ? `Langue : ${r.language}` : null,
        (participants[r.id] ?? []).length
          ? `Participants : ${(participants[r.id] ?? []).map((p) => `${p.first_name} ${p.last_name}`.trim()).join(", ")}`
          : null,
      ].filter(Boolean).join("\n") || null,
    }));
    download("visites-dst.ics", versIcs(evenements), "text/calendar;charset=utf-8");
  };

  const removeVisit = async (r: VisitRow) => {
    if (!confirm(
      `Supprimer la visite chez ${r.company?.name ?? "cette entreprise"} ?\n\n` +
      "L'entreprise et son historique sont conservés ; seule la fiche visite " +
      "(date, horaires, intervenant) est effacée."
    )) return;
    setRemoving(r.id);
    const { error } = await supabase.from("visits").delete().eq("id", r.id);
    setRemoving(null);
    if (error) {
      alert(error.message.toLowerCase().includes("policy")
        ? "Seuls les Team Leaders et les administrateurs peuvent supprimer une visite."
        : error.message);
      return;
    }
    load();
  };

  const exportCsv = () => download("planning-visites.csv", toCsv(filtered.map((r) => ({
    Entreprise: r.company?.name ?? "", Date: r.visit_date ?? "", Début: r.start_time ?? "", Fin: r.end_time ?? "",
    Adresse: r.address ?? "", Pôle: r.pole?.name ?? "", Responsable: fullName(r.owner),
    "Participants max": r.max_participants ?? "", Langue: r.language ?? "",
    Statut: r.confirmation,
  }))));

  if (loading) return <Spinner className="h-6 w-6" />;

  const confirmed = rows.filter((r) => r.confirmation === "confirmee").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Visites &amp; Planning</h1>
          <p className="text-sm text-slate-500">{confirmed} visite(s) confirmée(s) sur {rows.length} planifiée(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto">
            <option value="">Toutes</option>
            <option value="a_confirmer">À confirmer</option>
            <option value="confirmee">Confirmées</option>
            <option value="annulee">Annulées</option>
          </Select>
          <Select value={pole} onChange={(e) => setPole(e.target.value)} className="w-auto">
            <option value="">Tous les pôles</option>
            {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <div className="flex overflow-hidden rounded border border-slate-300 dark:border-slate-700">
            {([["liste", "Liste", ListIcon], ["calendrier", "Calendrier", CalendarDays]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => changeView(key)}
                className={
                  "flex items-center gap-1.5 px-2.5 py-2 text-[12px] font-semibold transition-colors " +
                  (view === key
                    ? "bg-brand-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300")
                }>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
          <Button variant="secondary" size="sm" onClick={exporterAgenda}
            title="Fichier .ics à importer dans Google Agenda, Outlook ou Apple Calendrier">
            <CalendarPlus size={14} /> Export agenda
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}
            title="Planning sur papier, à emporter sur place">
            <Printer size={14} /> Imprimer
          </Button>
          {canWrite && <Button size="sm" onClick={() => { setEdit(null); setModal(true); }}><CalendarPlus size={14} /> Ajouter</Button>}
        </div>
      </div>

      {conflicts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle size={16} /> {conflicts.length} conflit(s) détecté(s)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {conflicts.map((c, i) => <li key={i}>• {c}</li>)}
          </ul>
        </Card>
      )}

      {view === "calendrier" ? (
        <Calendrier mois={month} setMois={setMonth} visites={filtered}
          onOuvrir={(r) => { if (canWrite) { setEdit(r); setModal(true); } }} />
      ) : byDay.length === 0 ? (
        <Card><EmptyState title="Aucune visite planifiée"
          hint="Créez une visite depuis la fiche d'une entreprise ayant répondu positivement." /></Card>
      ) : byDay.map(([day, items]) => (
        <Card key={day} className="card-print">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
            <h2 className="text-sm font-semibold">{day === "Sans date" ? "Sans date" : fmtDate(day)}</h2>
            <span className="text-xs text-slate-400">{items.length} visite(s)</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/entreprises/${r.company_id}`} className="text-sm font-semibold hover:text-brand-600">
                    {r.company?.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {[r.start_time?.slice(0, 5), r.end_time?.slice(0, 5)].filter(Boolean).join(" – ") || "horaires à définir"}
                    {r.address ? ` · ${r.address}` : r.company?.city ? ` · ${r.company.city}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {fullName(r.owner) || "sans responsable"}
                    {r.language ? ` · ${r.language}` : ""}
                  </p>

                  {(() => {
                    const inscrits = participants[r.id] ?? [];
                    const jySuis = !!profile && inscrits.some((p) => p.profile_id === profile.id);
                    const complet = !!r.max_participants && inscrits.length >= r.max_participants;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Users size={12} className="text-slate-400" />
                          {inscrits.length}
                          {r.max_participants ? ` / ${r.max_participants}` : ""} inscrit{inscrits.length > 1 ? "s" : ""}
                        </span>
                        <span className="flex -space-x-1.5">
                          {inscrits.slice(0, 8).map((p) => (
                            <span key={p.profile_id} title={`${p.first_name} ${p.last_name}`.trim()}
                              className="rounded-sm ring-2 ring-white dark:ring-slate-900">
                              <Avatar name={initials(p)} size={20} />
                            </span>
                          ))}
                        </span>
                        {canWrite && (
                          <Button size="sm" variant={jySuis ? "secondary" : "ghost"}
                            disabled={inscription === r.id || (complet && !jySuis)}
                            onClick={() => basculerInscription(r.id, jySuis)}
                            title={complet && !jySuis ? "Nombre maximum de participants atteint" : undefined}>
                            {inscription === r.id ? <Spinner />
                              : jySuis ? <><Check size={12} /> Inscrit(e)</>
                              : complet ? "Complet"
                              : <><UserPlus size={12} /> Je participe</>}
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {r.pole && <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: r.pole.color }} />{r.pole.name}
                  </Badge>}
                  <Badge className={r.confirmation === "confirmee" ? "bg-green-100 text-green-800"
                    : r.confirmation === "annulee" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}>
                    {r.confirmation === "confirmee" ? "Confirmée" : r.confirmation === "annulee" ? "Annulée" : "À confirmer"}
                  </Badge>
                  {canWrite && <Button size="sm" variant="secondary" className="no-print" onClick={() => { setEdit(r); setModal(true); }}>Modifier</Button>}
                  {isStaff && (
                    <Button size="sm" variant="ghost" disabled={removing === r.id}
                      className="text-red-700 hover:bg-red-50 dark:text-red-400"
                      onClick={() => removeVisit(r)}>
                      {removing === r.id ? <Spinner /> : <Trash2 size={13} />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <VisitModal open={modal} companies={companies} visit={edit as unknown as Record<string, unknown>}
        companyId={edit?.company_id} onClose={() => { setModal(false); setEdit(null); }} onSaved={load} />
    </div>
  );
}
