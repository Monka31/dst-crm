"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [session, loading, router]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("email not confirmed")
          ? "Votre email n'est pas encore confirmé. Vérifiez votre boîte de réception."
          : "Email ou mot de passe incorrect."
      );
      return;
    }
    router.replace("/dashboard");
  };

  const magicLink = async () => {
    if (!email.trim()) { setError("Renseignez d'abord votre email."); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setInfo("Lien de connexion envoyé. Consultez votre boîte mail.");
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-navy-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-4">
          <img src="/essec-blanc.png" alt="ESSEC Business School" className="h-12 w-auto" />
          <span className="border-l border-white/20 pl-4">
            <span className="block font-serif text-lg font-semibold leading-tight">DST CRM</span>
            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.15em] text-navy-300">
              Pôle Entreprise
            </span>
          </span>
        </div>
        <div className="max-w-md">
          <p className="mb-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand-300">
            Digital Study Trip · MS MMD
          </p>
          <h1 className="font-serif text-[2.6rem] font-semibold leading-[1.12] tracking-[-0.015em]">
            Le centre de pilotage de la prospection entreprises.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-navy-200">
            Une seule base pour toute l&apos;équipe : les entreprises identifiées, les interlocuteurs,
            chaque prise de contact, les relances et les visites confirmées. Plus de doublons,
            plus de fichiers Excel qui divergent.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-[11px] leading-snug text-navy-300">
            <div><p className="font-serif text-3xl font-semibold text-white">1</p>source de vérité</div>
            <div><p className="font-serif text-3xl font-semibold text-white">12</p>membres synchronisés</div>
            <div><p className="font-serif text-3xl font-semibold text-white">0</p>double prise de contact</div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-navy-400">
          ESSEC Business School · Mastère Spécialisé<sup className="text-[8px]">®</sup> Marketing Management et Digital (MMD)
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <img src="/essec-bleu.png" alt="ESSEC Business School" className="h-11 w-auto" />
          </div>
          <h2 className="page-title">Connexion</h2>
          <p className="mt-1 text-sm text-slate-500">Accédez à votre espace de prospection.</p>

          <form onSubmit={signIn} className="mt-6 space-y-4">
            <Field label="Email">
              <Input type="email" required value={email} autoComplete="email"
                onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@essec.edu" />
            </Field>
            <div>
              <Field label="Mot de passe">
                <Input type="password" required value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </Field>
              <Link href="/mot-de-passe-oublie"
                className="mt-1.5 inline-block text-[11.5px] text-slate-500 hover:text-brand-700">
                Mot de passe oublié ?
              </Link>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{info}</p>}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Spinner /> : "Se connecter"}
            </Button>
            <Button type="button" variant="secondary" onClick={magicLink} disabled={busy} className="w-full">
              <Mail size={14} /> Recevoir un lien de connexion
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="font-medium text-brand-700 hover:underline">Créer votre compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
