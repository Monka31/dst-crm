import type { Interaction } from "@/lib/types";

/**
 * Reconstitue les fils à partir de la liste plate renvoyée par la base.
 *
 * Les messages d'origine sont triés du plus récent au plus ancien, comme
 * avant ; à l'intérieur d'un fil, en revanche, les réponses se lisent dans
 * l'ordre chronologique, sinon la conversation se lit à l'envers.
 *
 * Les deux tris sont faits ici, et non laissés à la base : deux messages du
 * même jour y arrivent dans un ordre indéterminé.
 *
 * Une réponse dont le message d'origine n'est pas dans la liste est traitée
 * comme un message d'origine, pour qu'elle reste visible quoi qu'il arrive.
 */
export function enFils(liste: Interaction[]): Interaction[] {
  const parId = new Map(liste.map((i) => [i.id, i]));
  const enfants = new Map<string, Interaction[]>();
  const racines: Interaction[] = [];

  liste.forEach((i) => {
    if (i.parent_id && parId.has(i.parent_id)) {
      enfants.set(i.parent_id, [...(enfants.get(i.parent_id) ?? []), i]);
    } else racines.push(i);
  });

  return racines
    .slice()
    .sort((a, b) => chrono(b, a))
    .map((r) => ({
      ...r,
      reponses: (enfants.get(r.id) ?? []).slice().sort(chrono),
    }));
}

/**
 * Ordre chronologique de deux messages.
 *
 * La date saisie n'a pas d'heure : plusieurs messages du même jour portent
 * exactement le même `occurred_at`, et les comparer seuls laissait l'ordre au
 * hasard de la base. Une réponse pouvait alors s'afficher avant le message
 * qu'elle répondait. On départage donc par l'horodatage de saisie, qui suit
 * l'ordre réel de l'échange dans la quasi-totalité des cas.
 */
export function chrono(a: Interaction, b: Interaction): number {
  const jour = a.occurred_at.localeCompare(b.occurred_at);
  if (jour !== 0) return jour;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}
