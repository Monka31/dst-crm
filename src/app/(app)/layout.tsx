"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, KanbanSquare, CalendarDays, CheckSquare,
  BarChart3, UsersRound, Settings as SettingsIcon, Plus, Search, Bell, Moon, Sun, MessagesSquare, ScrollText,
  LogOut, PanelLeftClose, PanelLeftOpen, Gauge, KeyRound,
} from "lucide-react";
import { useApp, useRealtime } from "@/components/AppContext";
import { supabase } from "@/lib/supabase";
import { Avatar, Button, Card, Modal, Spinner, cx, Badge } from "@/components/ui";
import { CompanyModal, ContactModal, FollowUpModal, InteractionModal, TaskModal, VisitModal } from "@/components/forms";
import { fullName, initials, fmtDate } from "@/lib/format";
import { statusMeta } from "@/lib/constants";

type NavItem = { href: string; label: string; icon: React.ElementType; viewer?: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, viewer: true },
  { href: "/avancement", label: "Avancement global", icon: Gauge, viewer: true },
  { href: "/entreprises", label: "Entreprises", icon: Building2, viewer: true },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/prospection", label: "Prospection", icon: KanbanSquare },
  { href: "/interactions", label: "Interactions", icon: MessagesSquare },
  { href: "/visites", label: "Visites & Planning", icon: CalendarDays, viewer: true },
  { href: "/taches", label: "Mes tâches", icon: CheckSquare },
  { href: "/resume", label: "Résumé", icon: ScrollText },
  { href: "/statistiques", label: "Statistiques", icon: BarChart3, viewer: true },
  { href: "/equipe", label: "Équipe", icon: UsersRound, viewer: true },
  { href: "/parametres", label: "Paramètres", icon: SettingsIcon },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, signOut, canWrite } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [modal, setModal] = useState<null | "company" | "contact" | "interaction" | "task" | "followup" | "visit">(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [alerts, setAlerts] = useState<{ id: string; text: string; href: string; kind: string }[]>([]);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [session, loading, router]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("dst-theme", next ? "dark" : "light"); } catch {}
  };

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase.from("companies").select("id,name").order("name");
    setCompanies((data as { id: string; name: string }[]) ?? []);
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!profile) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const [fu, tk, vs, noContact] = await Promise.all([
      supabase.from("follow_ups").select("id, due_date, company:companies(id,name)")
        .eq("status", "a_faire").lte("due_date", todayStr).limit(8),
      supabase.from("tasks").select("id, title, due_date, company:companies(id,name)")
        .eq("assigned_to", profile.id).neq("status", "fait").lte("due_date", todayStr).limit(8),
      supabase.from("visits").select("id, company:companies(id,name)")
        .eq("confirmation", "a_confirmer").limit(5),
      supabase.from("companies").select("id,name").eq("owner_id", profile.id)
        .in("status", ["a_contacter", "contact_en_cours"]).limit(5),
    ]);
    const out: { id: string; text: string; href: string; kind: string }[] = [];
    (fu.data ?? []).forEach((r) => {
      const c = r.company as unknown as { id: string; name: string } | null;
      out.push({ id: `fu-${r.id}`, kind: "relance", href: c ? `/entreprises/${c.id}` : "/taches",
        text: `Relance à effectuer — ${c?.name ?? ""} (${fmtDate(r.due_date as string)})` });
    });
    (tk.data ?? []).forEach((r) => {
      const c = r.company as unknown as { id: string; name: string } | null;
      out.push({ id: `tk-${r.id}`, kind: "tache", href: "/taches",
        text: `Tâche en retard — ${r.title}${c ? ` (${c.name})` : ""}` });
    });
    (vs.data ?? []).forEach((r) => {
      const c = r.company as unknown as { id: string; name: string } | null;
      out.push({ id: `vs-${r.id}`, kind: "visite", href: "/visites",
        text: `Visite à confirmer — ${c?.name ?? ""}` });
    });
    (noContact.data ?? []).forEach((r) => {
      out.push({ id: `nc-${r.id}`, kind: "info", href: `/entreprises/${r.id}`,
        text: `À faire avancer — ${r.name}` });
    });
    setAlerts(out);
  }, [profile]);

  useEffect(() => { if (profile) { loadCompanies(); loadAlerts(); } }, [profile, loadCompanies, loadAlerts]);
  useRealtime(["follow_ups", "tasks", "visits", "companies"], loadAlerts, "alerts");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading || !profile) {
    return <div className="flex h-screen items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  }

  const isViewer = profile.role === "viewer";
  const nav = NAV.filter((n) => {
    if (isViewer) return n.viewer;
    if (n.href === "/parametres") return profile.role === "admin";
    return true;
  });

  const refresh = () => { loadCompanies(); loadAlerts(); };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cx(
        "hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 md:flex",
        collapsed ? "w-[68px]" : "w-60"
      )}>
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800">
          <img src="/essec-bleu.png" alt="ESSEC" className="h-8 w-auto shrink-0" />
          {!collapsed && (
            <span className="min-w-0 border-l border-slate-200 pl-2.5 dark:border-slate-700">
              <span className="block truncate font-serif text-[15px] font-semibold leading-tight text-navy-900 dark:text-slate-50">
                DST CRM
              </span>
              <span className="block truncate text-[9.5px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                Pôle Entreprise
              </span>
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {nav.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} title={n.label}
                className={cx(
                  "relative flex items-center gap-2.5 rounded-sm py-2 pl-3.5 pr-2.5 text-[13px] transition-colors",
                  "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:transition-colors",
                  active
                    ? "bg-brand-50 font-semibold text-brand-800 before:bg-brand-500 dark:bg-brand-900/25 dark:text-brand-200"
                    : "text-slate-600 before:bg-transparent hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )}>
                <Icon size={17} className="shrink-0" />
                {!collapsed && <span className="truncate">{n.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-2 dark:border-slate-800">
          <div className={cx("flex items-center gap-2 rounded-lg px-2 py-2", collapsed && "justify-center")}>
            <Avatar name={initials(profile)} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{fullName(profile)}</p>
                <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {profile.role === "admin" ? "Admin" : profile.role === "team_leader" ? "Team leader"
                    : profile.role === "member" ? "Membre" : "Lecteur"}
                </p>
              </div>
            )}
          </div>
          {!collapsed && (
            <Link href="/nouveau-mot-de-passe"
              className="mt-1 flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <KeyRound size={15} /> Mon mot de passe
            </Link>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="mt-1 flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /> Réduire</>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
          <button onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-left text-[13px] text-slate-400 transition-colors hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600 sm:max-w-md">
            <Search size={15} />
            <span className="flex-1 truncate">Rechercher une entreprise, un contact…</span>
            <kbd className="hidden rounded border border-slate-300 px-1 text-[10px] dark:border-slate-600 sm:inline">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {canWrite && (
            <div className="relative">
              <Button size="sm" onClick={() => setAddOpen(!addOpen)}><Plus size={15} /> Ajouter</Button>
              {addOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
                  <Card className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden p-1">
                    {([
                      ["company", "Une entreprise"], ["contact", "Un contact"],
                      ["interaction", "Une interaction"], ["followup", "Une relance"],
                      ["task", "Une tâche"], ["visit", "Une visite"],
                    ] as const).map(([k, label]) => (
                      <button key={k}
                        onClick={() => { setModal(k); setAddOpen(false); loadCompanies(); }}
                        className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                        {label}
                      </button>
                    ))}
                  </Card>
                </>
              )}
            </div>
          )}

          <div className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell size={17} />
              {alerts.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                  {alerts.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                <Card className="absolute right-0 z-20 mt-1.5 max-h-96 w-80 overflow-y-auto p-1">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
                  {alerts.length === 0 && <p className="px-3 pb-3 text-sm text-slate-400">Rien à signaler. </p>}
                  {alerts.map((a) => (
                    <Link key={a.id} href={a.href} onClick={() => setNotifOpen(false)}
                      className="block rounded-md px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                      {a.text}
                    </Link>
                  ))}
                </Card>
              </>
            )}
          </div>

          <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button onClick={signOut} title="Se déconnecter"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <LogOut size={17} />
          </button>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          {nav.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href}
                className={cx("whitespace-nowrap rounded-sm px-2.5 py-1.5 text-xs",
                  active ? "bg-brand-50 font-semibold text-brand-800 dark:bg-brand-900/25 dark:text-brand-200"
                    : "text-slate-500")}>
                {n.label}
              </Link>
            );
          })}
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
          <div className="fade-in mx-auto max-w-[1500px] p-4 sm:p-6">{children}</div>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <CompanyModal open={modal === "company"} onClose={() => setModal(null)}
        onSaved={(id) => { refresh(); router.push(`/entreprises/${id}`); }} />
      <ContactModal open={modal === "contact"} onClose={() => setModal(null)} onSaved={refresh} companies={companies} />
      <InteractionModal open={modal === "interaction"} onClose={() => setModal(null)} onSaved={refresh} companies={companies} />
      <FollowUpModal open={modal === "followup"} onClose={() => setModal(null)} onSaved={refresh} companies={companies} />
      <TaskModal open={modal === "task"} onClose={() => setModal(null)} onSaved={refresh} companies={companies} />
      <VisitModal open={modal === "visit"} onClose={() => setModal(null)} onSaved={refresh} companies={companies} />
    </div>
  );
}

/* ---------------- Global search ---------------- */

function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ companies: Record<string, unknown>[]; contacts: Record<string, unknown>[] }>({ companies: [], contacts: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setQ(""); setRes({ companies: [], contacts: [] }); } }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setRes({ companies: [], contacts: [] }); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      const term = `%${q.trim()}%`;
      const [c, ct] = await Promise.all([
        supabase.from("companies")
          .select("id,name,status,city,sector, owner:profiles!companies_owner_id_fkey(first_name,last_name)")
          .or(`name.ilike.${term},city.ilike.${term},sector.ilike.${term}`).limit(8),
        supabase.from("contacts")
          .select("id,first_name,last_name,position,company:companies(id,name)")
          .or(`first_name.ilike.${term},last_name.ilike.${term},position.ilike.${term},email.ilike.${term}`).limit(8),
      ]);
      setBusy(false);
      setRes({ companies: (c.data as Record<string, unknown>[]) ?? [], contacts: (ct.data as Record<string, unknown>[]) ?? [] });
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <Modal open={open} onClose={onClose} title="Recherche globale" wide>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Spotify, Londres, Head of Marketing…"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-950" />
      {busy && <div className="mt-3"><Spinner /></div>}

      <div className="mt-4 space-y-4">
        {res.companies.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Entreprises</p>
            {res.companies.map((c) => {
              const owner = c.owner as { first_name: string; last_name: string } | null;
              return (
                <Link key={String(c.id)} href={`/entreprises/${c.id}`} onClick={onClose}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <span className="text-sm font-medium">{String(c.name)}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {c.city ? String(c.city) : ""} {owner ? `· ${fullName(owner)}` : ""}
                    <Badge className={statusMeta(String(c.status)).chip}>{statusMeta(String(c.status)).label}</Badge>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        {res.contacts.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacts</p>
            {res.contacts.map((c) => {
              const co = c.company as { id: string; name: string } | null;
              return (
                <Link key={String(c.id)} href={co ? `/entreprises/${co.id}` : "/contacts"} onClick={onClose}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <span className="text-sm font-medium">{`${c.first_name} ${c.last_name}`}</span>
                  <span className="text-xs text-slate-400">{c.position ? String(c.position) : ""} {co ? `· ${co.name}` : ""}</span>
                </Link>
              );
            })}
          </div>
        )}
        {q.trim().length >= 2 && !busy && res.companies.length === 0 && res.contacts.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">Aucun résultat.</p>
        )}
      </div>
    </Modal>
  );
}
