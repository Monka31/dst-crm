"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

/**
 * Sources d'image essayées dans l'ordre :
 *   1. le logo chargé à la main sur la fiche (Supabase Storage) ;
 *   2. le logo de marque déduit du domaine du site ;
 *   3. puis 4. deux services de favicon, au cas où le précédent soit
 *      indisponible.
 */
export function logoSources(logoUrl?: string | null, domain?: string | null): string[] {
  const out: string[] = [];
  if (logoUrl && logoUrl.trim()) out.push(logoUrl.trim());
  const d = domain?.trim().toLowerCase().replace(/^www\./, "");
  if (d) {
    out.push(`https://logo.clearbit.com/${d}`);
    out.push(`https://icons.duckduckgo.com/ip3/${d}.ico`);
    out.push(`https://www.google.com/s2/favicons?domain=${d}&sz=128`);
  }
  return out;
}

/** Au-delà de ce délai, une source qui ne répond pas est abandonnée. */
const DELAI_MAX = 2500;

export function CompanyLogo({
  name, logoUrl, domain, size = 28, variant = "vignette", className,
}: {
  name: string;
  logoUrl?: string | null;
  domain?: string | null;
  /** Côté en pixels — ignoré quand variant vaut "bandeau". */
  size?: number;
  variant?: "vignette" | "bandeau";
  className?: string;
}) {
  const sources = logoSources(logoUrl, domain);

  /**
   * L'image est affichée d'emblée, et non une fois `onLoad` reçu.
   *
   * La version précédente gardait le logo transparent tant qu'un `onLoad`
   * n'avait pas été capté : quand le navigateur servait l'image depuis son
   * cache, le chargement se terminait avant que React n'attache l'écouteur,
   * l'événement était perdu et le logo restait invisible — jusqu'à ce qu'un
   * changement de mode d'affichage force un remontage. L'affichage ne dépend
   * donc plus d'un événement : seul l'échec (`onError`) fait avancer d'une
   * source, et les initiales prennent le relais quand la liste est épuisée.
   * Avec `alt=""`, une image en échec n'affiche aucune icône de lien brisé.
   *
   * L'état est réinitialisé pendant le rendu, pas dans un effet, pour qu'un
   * changement d'entreprise reparte de la première source dès le même rendu.
   */
  const chaine = `${logoUrl ?? ""}|${domain ?? ""}`;
  const [etat, setEtat] = useState({ chaine, index: 0 });
  if (etat.chaine !== chaine) setEtat({ chaine, index: 0 });

  const suivante = () => setEtat((e) => ({ ...e, index: e.index + 1 }));

  const src = sources[etat.index];
  const initiales = name.slice(0, 2).toUpperCase();
  const bandeau = variant === "bandeau";

  /**
   * Deux filets de sécurité, car un `onError` peut ne jamais arriver :
   *   – le HTML est pré-rendu, donc l'échec d'une image déjà en cache peut
   *     survenir avant que React n'attache l'écouteur : on relit l'état réel
   *     de l'image au montage ;
   *   – un service de logos en panne ne renvoie pas d'erreur, il ne répond
   *     pas du tout. Sans délai maximum, la vignette resterait vide
   *     indéfiniment — c'était la cause des logos absents tant qu'on n'avait
   *     pas changé de mode d'affichage : le second passage trouvait l'échec
   *     en cache et basculait enfin sur la source suivante.
   */
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!src) return;
    const el = imgRef.current;
    if (el?.complete) {
      if (el.naturalWidth === 0) suivante();
      return;
    }
    const minuteur = window.setTimeout(() => {
      const img = imgRef.current;
      if (!img || !img.complete || img.naturalWidth === 0) suivante();
    }, DELAI_MAX);
    return () => window.clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <span
      style={bandeau ? undefined : { width: size, height: size }}
      className={cx(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        bandeau
          ? "h-24 w-full border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
          : "rounded-sm border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950",
        className
      )}
    >
      {src ? (
        <img
          key={src}
          ref={imgRef}
          src={src}
          alt=""
          onError={suivante}
          className={cx(
            "absolute inset-0 m-auto max-h-full max-w-full object-contain",
            bandeau ? "p-4" : "p-0.5"
          )}
        />
      ) : (
        <span className={cx(
          "select-none font-semibold",
          bandeau
            ? "font-serif text-2xl text-slate-300 dark:text-slate-700"
            : "text-[9px] text-slate-400 dark:text-slate-500"
        )}>
          {initiales}
        </span>
      )}
    </span>
  );
}
