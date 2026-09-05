"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { X, Loader2 } from "lucide-react";

/**
 * Assemble des classes Tailwind en résolvant les conflits.
 *
 * Sans cela, `Card` (qui pose `bg-white`) et un `className="bg-navy-900"` passé
 * de l'extérieur se retrouvent tous deux dans l'attribut : c'est l'ordre des
 * règles dans la feuille de style compilée qui tranche, pas celui de la chaîne.
 * Résultat : une carte censée être bleu marine s'affichait blanche, avec son
 * texte blanc devenu illisible. twMerge fait gagner la dernière classe écrite.
 */
export const cx = (...c: (string | false | null | undefined)[]) =>
  twMerge(c.filter(Boolean).join(" "));

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx(
      "rounded-lg border border-slate-200 bg-white shadow-sm",
      "dark:border-slate-800 dark:bg-slate-900", className
    )}>{children}</div>
  );
}

export function Button({
  children, variant = "primary", size = "md", className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 border-brand-600 hover:border-brand-700",
    secondary: "bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700",
    ghost: "bg-transparent text-slate-600 border-transparent hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    danger: "bg-red-700 text-white hover:bg-red-800 border-red-700 hover:border-red-800",
    success: "bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-700 hover:border-emerald-800",
  };
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded border font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]",
        variants[variant], className
      )}
    >{children}</button>
  );
}

const fieldBase =
  "w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition-colors " +
  "placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 " +
  "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldBase, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldBase, "resize-y", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldBase, "cursor-pointer pr-8", props.className)} />;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-400">{hint}</span>}
    </label>
  );
}

/**
 * Fenêtre modale rendue dans un portail sur <body>.
 * Le portail est indispensable : n'importe quel ancêtre porteur d'un
 * `transform`, `filter` ou `backdrop-filter` deviendrait le bloc conteneur
 * d'un élément `position: fixed` et découperait la fenêtre dans la zone de
 * contenu — c'était le bug des formulaires coupés en deux.
 */
export function Modal({
  open, onClose, title, children, wide,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("modal-open");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ height: "100dvh" }}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-navy-900/45 px-4 py-8 sm:py-12"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxHeight: "calc(100dvh - 4rem)" }}
        className={cx(
          "flex w-full flex-col rounded-lg border border-slate-200 bg-white shadow-lg",
          "dark:border-slate-700 dark:bg-slate-900",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="font-serif text-[17px] font-semibold text-navy-900 dark:text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/** Barre d'actions d'une fenêtre : reste visible au bas du contenu qui défile. */
export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-4 mt-5 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cx(
      "inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold leading-5",
      className
    )}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const tones = ["bg-brand-600", "bg-navy-700", "bg-teal-700", "bg-indigo-700", "bg-amber-600", "bg-slate-600"];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length;
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-sm font-semibold text-white", tones[idx])}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >{name || "?"}</span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-slate-400", className)} size={18} />;
}

export function Progress({ value, max, color = "bg-brand-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={cx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {hint && <p className="max-w-sm text-xs leading-relaxed text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}
