/**
 * Composition des comptes rendus quotidiens à partir du journal d'activité.
 *
 * Le journal enregistre des événements ; un compte rendu se lit en phrases.
 * Tout l'objet de ce fichier est de passer de l'un à l'autre : regrouper les
 * événements par personne, puis les écrire comme quelqu'un les raconterait.
 */

export type Evenement = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  label: string | null;
  company_id: string | null;
  created_at: string;
  actor?: { first_name: string; last_name: string } | null;
  company?: { name: string; pole_id: string | null } | null;
};

/** Verbe, singulier, pluriel — « 2 message LinkedIns » ne se dit pas. */
const CANAUX: Record<string, [string, string, string]> = {
  email: ["envoyé", "email", "emails"],
  linkedin_message: ["envoyé", "message LinkedIn", "messages LinkedIn"],
  linkedin_connexion: ["envoyé", "demande de connexion", "demandes de connexion"],
  appel: ["passé", "appel", "appels"],
  relance: ["envoyé", "relance", "relances"],
  rendez_vous: ["tenu", "rendez-vous", "rendez-vous"],
  reponse_recue: ["reçu", "réponse", "réponses"],
  rencontre: ["eu", "rencontre", "rencontres"],
};

const STATUTS: Record<string, string> = {
  a_identifier: "à identifier",
  a_contacter: "à contacter",
  contact_en_cours: "contact en cours",
  en_attente: "attente de réponse",
  relance: "relance nécessaire",
  positif: "réponse positive",
  visite_confirmee: "visite confirmée",
  refus: "refus",
  abandonne: "abandon",
};

/** « Heineken » · « Heineken et Jumbo » · « Heineken, Jumbo et 3 autres ». */
function enumerer(noms: string[], max = 3): string {
  const uniques = [...new Set(noms.filter(Boolean))];
  if (uniques.length === 0) return "";
  if (uniques.length <= max) {
    if (uniques.length === 1) return uniques[0];
    return `${uniques.slice(0, -1).join(", ")} et ${uniques[uniques.length - 1]}`;
  }
  const reste = uniques.length - max;
  return `${uniques.slice(0, max).join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
}

/** Noms distincts : réattribuer trois fois la même entreprise n'en fait pas trois. */
const distinctes = (liste: Evenement[]) =>
  [...new Set(liste.map((e) => e.label ?? "").filter(Boolean))];

const pluriel = (n: number, singulier: string, plur?: string) =>
  `${n} ${n > 1 ? (plur ?? singulier + "s") : singulier}`;

/** Le nouveau statut est encodé dans le libellé « Nom : ancien -> nouveau ». */
export function statutCible(label: string | null): string | null {
  const m = label?.match(/->\s*([a-z_]+)\s*$/i);
  return m ? m[1] : null;
}
export const nomDepuisStatut = (label: string | null) =>
  (label ?? "").split(" : ")[0] || "";

export const libelleStatut = (cle: string | null) => (cle ? STATUTS[cle] ?? cle : "");

/** Assemble la phrase du jour pour une personne. */
export function phrase(evenements: Evenement[]): string {
  const par = (a: string) => evenements.filter((e) => e.action === a);
  const nomEntreprise = (e: Evenement) => e.company?.name ?? "";
  const segments: string[] = [];

  const creees = distinctes(par("company_created"));
  if (creees.length)
    segments.push(`ajouté ${pluriel(creees.length, "entreprise")} (${enumerer(creees)})`);

  const contacts = par("contact_added");
  if (contacts.length)
    segments.push(`trouvé ${pluriel(contacts.length, "contact")} (${enumerer(contacts.map((e) => e.label ?? ""))})`);

  // Les interactions sont regroupées par canal : « envoyé 2 emails à X et Y ».
  const interactions = par("interaction_added");
  const parCanal = new Map<string, Evenement[]>();
  interactions.forEach((e) => {
    const c = e.label ?? "autre";
    parCanal.set(c, [...(parCanal.get(c) ?? []), e]);
  });
  parCanal.forEach((liste, canal) => {
    const [verbe, un, plusieurs] = CANAUX[canal] ?? ["enregistré", "échange", "échanges"];
    const cibles = enumerer(liste.map(nomEntreprise));
    const quantite = `${liste.length} ${liste.length > 1 ? plusieurs : un}`;
    segments.push(`${verbe} ${quantite}${cibles ? ` à ${cibles}` : ""}`);
  });

  // Un changement de statut est le seul événement qui raconte un résultat.
  const parStatut = new Map<string, string[]>();
  par("status_changed").forEach((e) => {
    const cible = statutCible(e.label);
    const nom = nomDepuisStatut(e.label);
    if (cible && nom) parStatut.set(cible, [...(parStatut.get(cible) ?? []), nom]);
  });
  parStatut.forEach((noms, cible) =>
    segments.push(`fait passer ${enumerer(noms)} en ${libelleStatut(cible)}`));

  const attributions = distinctes(par("owner_changed"));
  if (attributions.length)
    segments.push(`attribué ${pluriel(attributions.length, "entreprise")} (${enumerer(attributions)})`);

  const relances = par("followup_created");
  if (relances.length) segments.push(`programmé ${pluriel(relances.length, "relance")}`);
  const relancesFaites = par("followup_done");
  if (relancesFaites.length) segments.push(`clôturé ${pluriel(relancesFaites.length, "relance")}`);

  const taches = par("task_created");
  if (taches.length) segments.push(`créé ${pluriel(taches.length, "tâche")}`);
  const tachesFaites = par("task_done");
  if (tachesFaites.length) segments.push(`terminé ${pluriel(tachesFaites.length, "tâche")}`);

  const visites = par("visit_created");
  if (visites.length)
    segments.push(`organisé ${pluriel(visites.length, "visite")} (${enumerer(visites.map(nomEntreprise))})`);

  const notes = [...par("note_added"), ...par("contact_note_added")];
  if (notes.length) segments.push(`ajouté ${pluriel(notes.length, "note")}`);

  const deplaces = par("contact_moved");
  if (deplaces.length) segments.push(`déplacé ${pluriel(deplaces.length, "contact")}`);

  const supprimees = [...par("company_deleted"), ...par("contact_deleted"),
                      ...par("visit_deleted"), ...par("task_deleted"), ...par("followup_deleted")];
  if (supprimees.length) segments.push(`supprimé ${pluriel(supprimees.length, "élément")}`);

  if (segments.length === 0) return "";
  if (segments.length === 1) return `a ${segments[0]}.`;
  return `a ${segments.slice(0, -1).join(", ")} et ${segments[segments.length - 1]}.`;
}

/** Faits marquants d'une journée : ce qui a bougé, pas ce qui a été fait. */
export function faitsMarquants(evenements: Evenement[]) {
  const statuts = evenements.filter((e) => e.action === "status_changed");
  const vers = (cle: string) =>
    statuts.filter((e) => statutCible(e.label) === cle).map((e) => nomDepuisStatut(e.label));
  return {
    positifs: vers("positif"),
    visites: vers("visite_confirmee"),
    refus: [...vers("refus"), ...vers("abandonne")],
    contactees: vers("contact_en_cours"),
  };
}

export const cleJour = (iso: string) => iso.slice(0, 10);

export function libelleJour(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
