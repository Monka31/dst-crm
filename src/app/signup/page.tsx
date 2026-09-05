"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input, Spinner } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { first_name: first.trim(), last_name: last.trim() },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    setBusy(false);

    if (error) { setError(error.message); return; }
    if (data.session) { router.replace("/dashboard"); return; }
    setInfo("Compte créé. Confirmez votre adresse via le mail reçu, puis connectez-vous.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <img src="/essec-bleu.png" alt="ESSEC Business School" className="mb-7 h-11 w-auto" />
        <h2 className="page-title">Créer votre compte</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Votre compte est créé en <b className="font-semibold text-slate-700 dark:text-slate-300">lecture seule</b> :
          vous verrez l&apos;avancement du projet sans pouvoir rien modifier. Un administrateur du pôle
          vous attribue ensuite votre rôle et votre pôle.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <Input required value={first} onChange={(e) => setFirst(e.target.value)} />
            </Field>
            <Field label="Nom">
              <Input required value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mot de passe" hint="8 caractères minimum">
            <Input type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
          {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{info}</p>}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Spinner /> : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Déjà un compte ? <Link href="/login" className="font-medium text-brand-600 hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
