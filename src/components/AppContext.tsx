"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Pole, Profile, Settings } from "@/lib/types";

type Ctx = {
  session: Session | null;
  profile: Profile | null;
  poles: Pole[];
  members: Profile[];
  settings: Settings | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  canWrite: boolean;
  refreshRefs: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppCtx = createContext<Ctx>({} as Ctx);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [poles, setPoles] = useState<Pole[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshRefs = useCallback(async () => {
    const [p, m, s] = await Promise.all([
      supabase.from("poles").select("*").order("name"),
      supabase.from("profiles").select("*, pole:poles(*)").order("first_name"),
      supabase.from("settings").select("*").maybeSingle(),
    ]);
    setPoles((p.data as Pole[]) ?? []);
    setMembers((m.data as Profile[]) ?? []);
    setSettings((s.data as Settings) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
      if (!data.session && mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles").select("*, pole:poles(*)").eq("id", session.user.id).maybeSingle();
      if (cancelled) return;
      setProfile((data as Profile) ?? null);
      await refreshRefs();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session, refreshRefs]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const role = profile?.role;
  const value: Ctx = {
    session, profile, poles, members, settings, loading,
    isAdmin: role === "admin",
    isStaff: role === "admin" || role === "team_leader",
    canWrite: role === "admin" || role === "team_leader" || role === "member",
    refreshRefs, signOut,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/**
 * Rafraîchissement collaboratif, écrit pour tenir à une cinquantaine de
 * comptes sur le forfait gratuit de Supabase.
 *
 * La version précédente abonnait tout le monde au temps réel et rechargeait
 * la page entière 250 ms après la moindre écriture. À 12 éditeurs et 40
 * lecteurs, une seule modification déclenchait 52 rechargements complets :
 * le quota mensuel de transfert y passait en quelques jours.
 *
 * Trois mesures :
 *   – les lecteurs ne s'abonnent pas du tout. Ils consultent une avancée, pas
 *     un flux : un rafraîchissement à leur retour sur l'onglet suffit, et ils
 *     cessent d'occuper une connexion temps réel ;
 *   – un onglet caché ne recharge rien. Il note qu'il a pris du retard et se
 *     met à jour une seule fois quand on revient dessus — décisif, puisque
 *     l'outil reste ouvert dans un onglet toute la journée ;
 *   – le délai d'attente passe de 250 ms à 3 s, pour qu'une rafale de
 *     modifications ne provoque qu'un seul rechargement.
 */
const DELAI_REGROUPEMENT = 3000;
const DELAI_LECTEUR = 60000;

export function useRealtime(tables: string[], cb: () => void, key = "rt") {
  const { profile } = useContext(AppCtx);
  const lecteur = profile?.role === "viewer";

  // La fonction de rechargement est gardée dans une référence : sans cela, un
  // changement d'identité de la callback détruirait et recréerait le canal.
  const rappel = useRef(cb);
  rappel.current = cb;

  useEffect(() => {
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

    if (lecteur) {
      let dernier = Date.now();
      const auRetour = () => {
        if (!visible() || Date.now() - dernier < DELAI_LECTEUR) return;
        dernier = Date.now();
        rappel.current();
      };
      document.addEventListener("visibilitychange", auRetour);
      return () => document.removeEventListener("visibilitychange", auRetour);
    }

    let minuteur: ReturnType<typeof setTimeout> | null = null;
    let enRetard = false;

    const declencher = () => {
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        if (visible()) rappel.current();
        else enRetard = true;
      }, DELAI_REGROUPEMENT);
    };

    const auRetour = () => {
      if (visible() && enRetard) { enRetard = false; rappel.current(); }
    };
    document.addEventListener("visibilitychange", auRetour);

    const canal = supabase.channel(`${key}-${tables.join("-")}`);
    tables.forEach((t) => {
      canal.on("postgres_changes", { event: "*", schema: "public", table: t }, declencher);
    });
    canal.subscribe();

    return () => {
      if (minuteur) clearTimeout(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), key, lecteur]);
}
