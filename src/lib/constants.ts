export type CompanyStatus =
  | "a_identifier" | "a_contacter" | "contact_en_cours" | "en_attente"
  | "relance" | "positif" | "visite_confirmee" | "refus" | "abandonne";

export const STATUSES: {
  key: CompanyStatus; label: string; dot: string; chip: string; kanban: string;
}[] = [
  { key: "a_identifier", label: "À identifier", dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", kanban: "border-t-slate-400" },
  { key: "a_contacter", label: "À contacter", dot: "bg-sky-500",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", kanban: "border-t-sky-500" },
  { key: "contact_en_cours", label: "Contact en cours", dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", kanban: "border-t-violet-500" },
  { key: "en_attente", label: "En attente de réponse", dot: "bg-orange-500",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", kanban: "border-t-orange-500" },
  { key: "relance", label: "Relance nécessaire", dot: "bg-amber-400",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", kanban: "border-t-amber-400" },
  { key: "positif", label: "Réponse positive", dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", kanban: "border-t-emerald-500" },
  { key: "visite_confirmee", label: "Visite confirmée", dot: "bg-green-600",
    chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300", kanban: "border-t-green-600" },
  { key: "refus", label: "Refus", dot: "bg-red-500",
    chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", kanban: "border-t-red-500" },
  { key: "abandonne", label: "Abandonné", dot: "bg-neutral-700",
    chip: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300", kanban: "border-t-neutral-700" },
];

export const statusMeta = (s: string) =>
  STATUSES.find((x) => x.key === s) ?? STATUSES[0];

export const PRIORITIES = [
  { key: "basse", label: "Basse", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  { key: "moyenne", label: "Moyenne", chip: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { key: "haute", label: "Haute", chip: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" },
];

export const SOURCES = [
  { key: "reseau_personnel", label: "Réseau personnel" },
  { key: "alumni", label: "Alumni" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "professeur", label: "Professeur" },
  { key: "partenaire", label: "Entreprise partenaire" },
  { key: "google", label: "Recherche Google" },
  { key: "recommandation", label: "Recommandation" },
  { key: "autre", label: "Autre" },
];

export const RELATION_TYPES = [
  { key: "alumni_essec", label: "Alumni ESSEC" },
  { key: "contact_personnel", label: "Contact personnel" },
  { key: "contact_professionnel", label: "Contact professionnel" },
  { key: "professeur", label: "Professeur" },
  { key: "contact_linkedin", label: "Contact LinkedIn" },
  { key: "contact_direct", label: "Contact direct entreprise" },
  { key: "recommandation", label: "Recommandation" },
  { key: "autre", label: "Autre" },
];

export const CHANNELS = [
  { key: "email", label: "Email", icon: "mail" },
  { key: "linkedin_message", label: "Message LinkedIn", icon: "linkedin" },
  { key: "linkedin_connexion", label: "Demande de connexion", icon: "userplus" },
  { key: "appel", label: "Appel téléphonique", icon: "phone" },
  { key: "relance", label: "Relance", icon: "repeat" },
  { key: "rendez_vous", label: "Rendez-vous", icon: "calendar" },
  { key: "reponse_recue", label: "Réponse reçue", icon: "inbox" },
  { key: "rencontre", label: "Rencontre physique", icon: "users" },
];

export const OUTCOMES = [
  { key: "en_attente", label: "En attente" },
  { key: "positif", label: "Positif" },
  { key: "negatif", label: "Négatif" },
  { key: "neutre", label: "Neutre" },
  { key: "a_relancer", label: "À relancer" },
];

export const ROLES = [
  { key: "admin", label: "Administrateur" },
  { key: "team_leader", label: "Team Leader" },
  { key: "member", label: "Membre" },
  { key: "viewer", label: "Lecteur" },
];

export const labelOf = (list: { key: string; label: string }[], k?: string | null) =>
  list.find((x) => x.key === k)?.label ?? "—";

export const CONTACT_STATUSES = [
  { key: "a_contacter", label: "À contacter",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { key: "contacte", label: "Contacté",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { key: "a_repondu", label: "A répondu",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { key: "sans_reponse", label: "Ne répond pas",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { key: "mauvais_interlocuteur", label: "Mauvais interlocuteur",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" },
  { key: "a_quitte", label: "A quitté l'entreprise",
    chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
];

export const contactStatusMeta = (s: string | null) =>
  CONTACT_STATUSES.find((x) => x.key === s) ?? CONTACT_STATUSES[0];

export const EMAIL_STATUSES = [
  { key: "inconnu", label: "Non précisé",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  { key: "verifie", label: "Email vérifié",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { key: "devine", label: "Email deviné",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
];

export const emailStatusMeta = (s: string | null) =>
  EMAIL_STATUSES.find((x) => x.key === s) ?? EMAIL_STATUSES[0];

/** Canaux proposés pour un modèle de message. */
export const TEMPLATE_CHANNELS = [
  { key: "email", label: "Email" },
  { key: "linkedin_connexion", label: "LinkedIn — demande de connexion" },
  { key: "linkedin_message", label: "LinkedIn — message" },
  { key: "relance", label: "Relance" },
  { key: "telephone", label: "Trame d'appel" },
  { key: "autre", label: "Autre" },
];

export const templateChannelLabel = (k: string) =>
  TEMPLATE_CHANNELS.find((c) => c.key === k)?.label ?? "Autre";
