/**
 * Mémorise la dernière liste consultée, filtres compris.
 *
 * Les flèches « Toutes les entreprises » et « Tous les contacts » sont des
 * liens vers l'adresse nue de la liste, pas des retours en arrière. Quels que
 * soient les filtres posés, elles ramenaient donc toujours la liste complète.
 *
 * Plutôt que d'appeler `router.back()`, qui sortirait de l'application quand
 * la fiche a été ouverte directement — lien partagé, rechargement, arrivée
 * depuis le tableau de bord —, on retient l'adresse exacte de la liste au
 * moment où on la quitte, et la flèche y retourne.
 *
 * Le stockage est celui de l'onglet : deux onglets ouverts sur deux filtres
 * différents ne se marchent pas dessus, et rien ne survit à la fermeture.
 */

const cle = (liste: string) => `dst-retour-${liste}`;

/** Appelé par une page de liste à chaque fois que son adresse change. */
export function memoriserListe(liste: string, adresse: string) {
  try { sessionStorage.setItem(cle(liste), adresse); } catch {}
}

/**
 * Adresse de retour pour une fiche.
 *
 * Renvoie l'adresse nue si rien n'a été mémorisé, ou si ce qui l'a été ne
 * correspond pas à la liste demandée : une valeur trafiquée ne doit pas
 * pouvoir rediriger ailleurs dans l'application, ni hors de celle-ci.
 */
export function lienRetourListe(liste: string): string {
  const base = `/${liste}`;
  try {
    const v = sessionStorage.getItem(cle(liste));
    if (v && (v === base || v.startsWith(`${base}?`))) return v;
  } catch {}
  return base;
}
