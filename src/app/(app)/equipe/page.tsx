"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Plus, Trash2, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp, useRealtime } from "@/components/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, ModalActions, Select, Spinner } from "@/components/ui";
import { ROLES, labelOf } from "@/lib/constants";
import { fmtDate, fullName, initials } from "@/lib/format";
import type { Profile } from "@/lib/types";

type Invitation = {
  id: string; email: string; role: string; pole_id: string | null;
  accepted_at: string | null; created_at: string;
};

export default function TeamPage() {
  const { members, poles, isAdmin, profile, refreshRefs } = useApp();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [counts, setCounts] = useState<Record<string, { companies: number; visits: number }>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"editeurs" | "lecteurs">("editeurs");
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const compRes = await supabase.from("companies").select("owner_id,status");
    const comps = (compRes.data as { owner_id: string | null; status: string }[]) ?? [];
    const agg: Record<string, { companies: number; visits: number }> = {};
    comps.forEach((c) => {
      if (!c.owner_id) return;
      agg[c.owner_id] = agg[c.owner_id] ?? { companies: 0, visits: 0 };
      agg[c.owner_id].companies++;
      if (c.status === "visite_confirmee") agg[c.owner_id].visits++;
    });
    setCounts(agg);
    if (isAdmin) {
      const inv = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
      setInvites((inv.data as Invitation[]) ?? []);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["profiles", "companies"], load, "team");

  const changeRole = async (id: string, role: string) => {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) alert(error.message);
    await refreshRefs();
  };
  const changePole = async (id: string, pole_id: string) => {
    const { error } = await supabase.from("profiles").update({ pole_id: pole_id || null }).eq("id", id);
    if (error) alert(error.message);
    await refreshRefs();
  };
  const removeMember = async (m: Profile) => {
    const nom = fullName(m) || m.email;
    if (!confirm(
      `Retirer ${nom} de l'équipe ?\n\n` +
      "Son compte est supprimé et il ne pourra plus se connecter. " +
      "Les entreprises, contacts et interactions qu'il a saisis sont conservés : " +
      "ils passent simplement en « non attribué ».\n\nCette action est définitive."
    )) return;
    setRemoving(m.id);
    const { error } = await supabase.rpc("admin_delete_user", { p_user: m.id });
    setRemoving(null);
    if (error) { alert(error.message); return; }
    await refreshRefs();
  };

  const removeInvite = async (id: string) => {
    await supabase.from("invitations").delete().eq("id", id);
    load();
  };

  const signupUrl = typeof window !== "undefined" ? `${window.location.origin}/signup` : "";

  const editeurs = members.filter((m) => m.role !== "viewer");
  const lecteurs = members.filter((m) => m.role === "viewer");
  const shown = tab === "editeurs" ? editeurs : lecteurs;

  if (loading) return <Spinner className="h-6 w-6" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Équipe</h1>
          <p className="text-sm text-slate-500">{members.length} compte(s) · {poles.length} pôle(s)</p>
        </div>
        {isAdmin && <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Pré-attribuer un rôle</Button>}
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {([
          ["editeurs", "Éditeurs", editeurs.length],
          ["lecteurs", "Lecteurs", lecteurs.length],
        ] as const).map(([key, label, n]) => (
          <button key={key} onClick={() => setTab(key)}
            className={
              "border-b-2 px-3.5 py-2 text-sm transition-colors " +
              (tab === key
                ? "border-brand-500 font-semibold text-brand-700 dark:text-brand-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")
            }>
            {label} <span className="ml-1 text-xs text-slate-400">{n}</span>
          </button>
        ))}
      </div>

      <p className="-mt-2 text-xs leading-relaxed text-slate-500">
        {tab === "editeurs"
          ? "Administrateurs, Team Leaders et Membres : ils saisissent et modifient les données de prospection."
          : "Lecteurs : accès en consultation seule au tableau de bord, à l'avancement et au planning. C'est le rôle attribué par défaut à toute nouvelle inscription."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.length === 0 && (
          <p className="text-sm text-slate-400">
            {tab === "editeurs" ? "Aucun éditeur." : "Aucun lecteur pour l'instant."}
          </p>
        )}
        {shown.map((m: Profile) => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start gap-3">
              <Avatar name={initials(m)} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{fullName(m) || m.email}</p>
                <p className="truncate text-xs text-slate-400">{m.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {isAdmin ? (
                    <>
                      <Select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className="w-auto text-xs">
                        {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </Select>
                      <Select value={m.pole_id ?? ""} onChange={(e) => changePole(m.id, e.target.value)} className="w-auto text-xs">
                        <option value="">Sans pôle</option>
                        {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </>
                  ) : (
                    <>
                      <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{labelOf(ROLES, m.role)}</Badge>
                      {m.pole && <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <span className="h-2 w-2 rounded-full" style={{ background: m.pole.color }} />{m.pole.name}
                      </Badge>}
                    </>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {counts[m.id]?.companies ?? 0} entreprise(s) · {counts[m.id]?.visits ?? 0} visite(s) obtenue(s)
                </p>
                {isAdmin && m.id !== profile?.id && (
                  <Button size="sm" variant="ghost" disabled={removing === m.id}
                    className="mt-2 px-1.5 text-red-700 hover:bg-red-50 dark:text-red-400"
                    onClick={() => removeMember(m)}>
                    {removing === m.id ? <Spinner /> : <><Trash2 size={12} /> Retirer de l&apos;équipe</>}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <span><h2 className="card-title">Pré-attributions</h2><p className="mt-0.5 text-[11px] text-slate-400">Facultatif. Sans pré-attribution, un nouveau compte arrive en Lecteur.</p></span>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="hidden sm:inline">Lien d&apos;inscription :</span>
              <code className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">{signupUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(signupUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </Button>
            </div>
          </div>
          {invites.length === 0 ? <EmptyState title="Aucune pré-attribution" hint="Vos camarades peuvent créer leur compte librement : ils arrivent en Lecteur et vous leur donnez leur rôle ici. Une pré-attribution leur évite ce passage." />
            : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {invites.map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{i.email}</p>
                      <p className="text-xs text-slate-400">
                        {labelOf(ROLES, i.role)}
                        {i.pole_id ? ` · ${poles.find((p) => p.id === i.pole_id)?.name ?? ""}` : ""}
                        {" · invité le "}{fmtDate(i.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={i.accepted_at ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>
                        {i.accepted_at ? "Compte créé" : "En attente"}
                      </Badge>
                      {!i.accepted_at && (
                        <a href={`mailto:${i.email}?subject=${encodeURIComponent("Accès au CRM du Digital Study Trip")}&body=${encodeURIComponent(
                          `Salut,\n\nTu peux créer ton compte sur le CRM du Digital Study Trip ici : ${signupUrl}\nUtilise bien cette adresse email (${i.email}).\n\nÀ tout de suite !`
                        )}`}>
                          <Button size="sm" variant="secondary"><Mail size={13} /> Envoyer</Button>
                        </a>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeInvite(i.id)}><Trash2 size={13} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>
      )}

      <InviteModal open={open} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}

function InviteModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { poles, profile } = useApp();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [pole, setPole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setEmail(""); setRole("member"); setPole(""); setError(null); } }, [open]);

  const save = async () => {
    setBusy(true); setError(null);
    const { error } = await supabase.from("invitations").insert({
      email: email.trim().toLowerCase(), role, pole_id: pole || null, invited_by: profile?.id,
    });
    setBusy(false);
    if (error) { setError(error.message.includes("duplicate") ? "Cette adresse a déjà une pré-attribution." : error.message); return; }
    onSaved(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Pré-attribuer un rôle">
      <div className="space-y-3">
        <Field label="Email" hint="Au moment où cette adresse créera son compte, elle recevra directement ce rôle et ce pôle.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@essec.edu" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rôle">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="Pôle">
            <Select value={pole} onChange={(e) => setPole(e.target.value)}>
              <option value="">Sans pôle</option>
              {poles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={busy || !email.trim()}>{busy ? <Spinner /> : "Enregistrer"}</Button>
        </ModalActions>
      </div>
    </Modal>
  );
}
