"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input, Spinner } from "@/components/ui";

/**
 * Sert deux cas :
 *  – arrivée depuis un lien « mot de passe oublié » (Supabase ouvre une session
 *    de récupération à partir du fragment d'URL) ;
 *  – changement volontaire par quelqu'un de déjà connecté.
 */
export default function NewPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(!!data.session);
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    };
    // Le jeton de récupération arrive dans le fragment d'URL : on laisse au
    // client Supabase le temps de l'échanger contre une session.
    const t = setTimeout(check, 700);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setHasSession(!!s);
      setEmail(s?.user.email ?? null);
      setReady(true);
    });
    return () => { cancelled = true; clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Les deux mots de passe ne sont pas identiques."); return; }
    if (password.length < 8) { setError("8 caractères minimum."); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.replace("/dashboard"), 1800);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <img src="/essec-bleu.png" alt="ESSEC Business School" className="mb-7 h-11 w-auto" />
        <h1 className="page-title">Nouveau mot de passe</h1>

        {!ready ? (
          <div className="mt-6"><Spinner className="h-5 w-5" /></div>
        ) : done ? (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            Mot de passe modifié. Redirection vers votre tableau de bord…
          </p>
        ) : !hasSession ? (
          <>
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              Ce lien est expiré ou a déjà été utilisé. Les liens de réinitialisation ne valent
              qu&apos;une heure et qu&apos;une seule fois.
            </p>
            <Link href="/mot-de-passe-oublie">
              <Button className="mt-4 w-full">Demander un nouveau lien</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              {email ? <>Compte : <b className="text-slate-700 dark:text-slate-300">{email}</b></> : "Choisissez un nouveau mot de passe."}
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Nouveau mot de passe" hint="8 caractères minimum">
                <Input type="password" required autoFocus minLength={8} value={password}
                  autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="Confirmation">
                <Input type="password" required minLength={8} value={confirm}
                  autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
              </Field>

              {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Spinner /> : "Enregistrer"}
              </Button>
            </form>
          </>
        )}

        <Link href="/login" className="mt-6 inline-block text-xs text-slate-500 hover:text-brand-700">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
