"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input, Spinner } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("rate")
          ? "Trop de demandes en peu de temps. Patientez une heure, ou demandez à un administrateur du pôle de vous envoyer un lien depuis Supabase."
          : error.message
      );
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <img src="/essec-bleu.png" alt="ESSEC Business School" className="mb-7 h-11 w-auto" />

        <h1 className="page-title">Mot de passe oublié</h1>

        {sent ? (
          <>
            <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] leading-relaxed text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              Si un compte existe pour <b>{email.trim()}</b>, un lien de réinitialisation vient d&apos;y être
              envoyé. Il est valable une heure. Pensez à regarder dans les indésirables.
            </p>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
              Rien reçu au bout de quelques minutes ? L&apos;envoi d&apos;emails est limité à quelques messages
              par heure. Un administrateur du pôle peut vous débloquer immédiatement depuis Supabase.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Indiquez votre adresse : nous vous envoyons un lien pour en définir un nouveau.
              Personne, pas même les administrateurs, ne peut lire votre mot de passe actuel.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Email">
                <Input type="email" required autoFocus value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@essec.edu" />
              </Field>

              {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Spinner /> : "Envoyer le lien"}
              </Button>
            </form>
          </>
        )}

        <Link href="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700">
          <ArrowLeft size={13} /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
