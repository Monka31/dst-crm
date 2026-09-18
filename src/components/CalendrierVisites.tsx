"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card } from "@/components/ui";

export type VisitRow = {
  id: string; company_id: string; visit_date: string | null;
  start_time: string | null; end_time: string | null; address: string | null;
  max_participants: number | null; min_participants: number | null;
  speaker: string | null; language: string | null; visit_type: string | null;
  contact_phone: string | null; contact_email: string | null;
  confirmation: string; pole_id: string | null; owner_id: string | null;
  company: { id: string; name: string; city: string | null } | null;
  pole: { name: string; color: string } | null;
  owner: { first_name: string; last_name: string } | null;
};

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function Calendrier({
  mois, setMois, visites, onOuvrir,
}: {
  mois: string;
  setMois: (m: string) => void;
  visites: VisitRow[];
  onOuvrir: (r: VisitRow) => void;
}) {
  if (!mois) return null;
  const [an, m] = mois.split("-").map(Number);

  const premier = new Date(Date.UTC(an, m - 1, 1));
  const nbJours = new Date(Date.UTC(an, m, 0)).getUTCDate();
  // getUTCDay : 0 = dimanche ; on veut la semaine qui commence le lundi
  const decalage = (premier.getUTCDay() + 6) % 7;

  const parJour = new Map<string, VisitRow[]>();
  visites.forEach((v) => {
    if (!v.visit_date) return;
    parJour.set(v.visit_date, [...(parJour.get(v.visit_date) ?? []), v]);
  });

  const cases: (string | null)[] = [
    ...Array(decalage).fill(null),
    ...Array.from({ length: nbJours }, (_, i) =>
      `${an}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cases.length % 7 !== 0) cases.push(null);

  const glisser = (pas: number) => {
    const d = new Date(Date.UTC(an, m - 1 + pas, 1));
    setMois(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const sansDate = visites.filter((v) => !v.visit_date);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <Button size="sm" variant="ghost" onClick={() => glisser(-1)} aria-label="Mois précédent">
            <ChevronLeft size={15} />
          </Button>
          <h2 className="font-serif text-base font-semibold capitalize text-navy-900 dark:text-slate-100">
            {MOIS[m - 1]} {an}
          </h2>
          <Button size="sm" variant="ghost" onClick={() => glisser(1)} aria-label="Mois suivant">
            <ChevronRight size={15} />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          {JOURS.map((j) => (
            <div key={j} className="px-2 py-1.5 text-center text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              {j}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cases.map((iso, i) => {
            const jour = iso ? Number(iso.slice(8)) : null;
            const duJour = iso ? (parJour.get(iso) ?? []) : [];
            return (
              <div key={i}
                className={
                  "min-h-[104px] border-b border-r border-slate-100 p-1.5 dark:border-slate-800 " +
                  (iso ? "" : "bg-slate-50/60 dark:bg-slate-950/40 ") +
                  (iso === aujourdhui ? "bg-brand-50/60 dark:bg-brand-900/10" : "")
                }>
                {jour && (
                  <p className={
                    "mb-1 text-[11px] font-semibold " +
                    (iso === aujourdhui ? "text-brand-700 dark:text-brand-300" : "text-slate-400")
                  }>{jour}</p>
                )}
                <div className="space-y-1">
                  {duJour.map((v) => (
                    <button key={v.id} onClick={() => onOuvrir(v)}
                      className={
                        "block w-full truncate rounded-sm border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:brightness-95 " +
                        (v.confirmation === "confirmee"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : v.confirmation === "annulee"
                          ? "border-slate-400 bg-slate-100 text-slate-500 line-through dark:bg-slate-800"
                          : "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300")
                      }>
                      {v.start_time && <b className="tabular">{v.start_time.slice(0, 5)} </b>}
                      {v.company?.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {sansDate.length > 0 && (
        <Card className="p-4">
          <p className="label mb-2">Sans date ({sansDate.length})</p>
          <div className="flex flex-wrap gap-2">
            {sansDate.map((v) => (
              <button key={v.id} onClick={() => onOuvrir(v)}
                className="rounded-sm border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                {v.company?.name}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
