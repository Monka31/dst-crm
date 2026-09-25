/**
 * Modèles de messages : variables, nettoyage du HTML et rendu.
 *
 * Le corps d'un modèle est du HTML saisi par un administrateur. Il n'est
 * jamais inséré tel quel : il passe par `nettoyerHtml`, qui ne laisse
 * survivre qu'une liste fermée de balises et la seule propriété `color`.
 * Les parties variables sont écrites `{{prenom}}` et rendues en évidence à
 * l'affichage, puis remplacées par les vraies valeurs à la copie.
 */

export type Variable = { cle: string; label: string; exemple: string };

export const VARIABLES: Variable[] = [
  { cle: "prenom", label: "Prénom du contact", exemple: "Marie" },
  { cle: "nom", label: "Nom du contact", exemple: "Dubois" },
  { cle: "poste", label: "Poste du contact", exemple: "Directrice Marketing" },
  { cle: "entreprise", label: "Nom de l'entreprise", exemple: "Heineken" },
  { cle: "ville", label: "Ville de l'entreprise", exemple: "Amsterdam" },
  { cle: "secteur", label: "Secteur de l'entreprise", exemple: "Grande Consommation" },
  { cle: "mon_prenom", label: "Mon prénom", exemple: "Marco" },
  { cle: "mon_nom", label: "Mon nom", exemple: "Faucher" },
  { cle: "ville_voyage", label: "Ville du voyage", exemple: "Amsterdam" },
  { cle: "dates_voyage", label: "Dates du voyage", exemple: "9 au 14 novembre 2026" },
  { cle: "date_dernier_contact", label: "Date du dernier contact", exemple: "12 septembre" },
];

export const estVariableConnue = (cle: string) => VARIABLES.some((v) => v.cle === cle);

const BALISES_AUTORISEES = new Set(["B", "STRONG", "I", "EM", "U", "SPAN", "DIV", "P", "BR", "UL", "OL", "LI", "A"]);

/** Supprimées avec leur contenu : garder le texte d'un script n'aurait aucun sens. */
const BALISES_SUPPRIMEES = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "SVG"]);

/** Seules propriétés de style conservées : de quoi mettre en gras et en couleur. */
const STYLES_AUTORISES = ["color", "font-weight", "font-style", "text-decoration", "text-decoration-line"];

/**
 * Ne conserve qu'une liste fermée de balises, quelques propriétés de style et
 * les liens http(s). Tout le reste — attributs d'événement, `javascript:`,
 * balises actives — disparaît. Le HTML est analysé dans un élément détaché,
 * qui n'exécute jamais ce qu'il contient.
 */
export function nettoyerHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const bac = document.createElement("div");
  bac.innerHTML = html;

  const parcourir = (noeud: Element) => {
    [...noeud.children].forEach((enfant) => {
      if (BALISES_SUPPRIMEES.has(enfant.tagName)) { enfant.remove(); return; }
      parcourir(enfant);
      if (!BALISES_AUTORISEES.has(enfant.tagName)) {
        enfant.replaceWith(...Array.from(enfant.childNodes));
        return;
      }
      const style = (enfant as HTMLElement).style;
      const styles = STYLES_AUTORISES
        .map((prop) => [prop, style?.getPropertyValue(prop) ?? ""] as const)
        .filter(([, v]) => v);
      const lien = enfant.tagName === "A" ? enfant.getAttribute("href") ?? "" : "";

      [...enfant.attributes].forEach((a) => enfant.removeAttribute(a.name));
      styles.forEach(([prop, v]) => (enfant as HTMLElement).style.setProperty(prop, v));
      if (lien && /^https?:\/\//i.test(lien)) {
        enfant.setAttribute("href", lien);
        enfant.setAttribute("rel", "noopener noreferrer");
        enfant.setAttribute("target", "_blank");
      }
    });
  };
  parcourir(bac);
  return bac.innerHTML;
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Met en évidence les `{{variables}}` pour la lecture à l'écran.
 * Une variable inconnue est signalée en rouge : la faute de frappe se voit.
 */
export function surlignerVariables(html: string): string {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, cle: string) => {
    const connue = estVariableConnue(cle);
    const classes = connue
      ? "rounded-sm bg-brand-100 px-1 font-semibold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200"
      : "rounded-sm bg-red-100 px-1 font-semibold text-red-700 line-through dark:bg-red-950 dark:text-red-300";
    return `<span class="${classes}">${echapper(cle)}</span>`;
  });
}

/** Remplace les variables par leurs valeurs ; celles sans valeur restent visibles. */
export function remplacerVariables(html: string, valeurs: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (entier, cle: string) => {
    const v = valeurs[cle.toLowerCase()];
    return v && v.trim() ? echapper(v) : entier;
  });
}

/**
 * Rendu d'aperçu : les valeurs connues sont injectées et discrètement
 * soulignées pour pouvoir être relues, celles qui manquent restent visibles
 * en orange, et une variable mal orthographiée ressort en rouge barré.
 */
export function apercuHtml(html: string, valeurs: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, cle: string) => {
    const v = valeurs[cle.toLowerCase()];
    if (v && v.trim())
      return `<span class="rounded-sm bg-brand-50 px-0.5 text-brand-900 dark:bg-brand-950/60 dark:text-brand-200">${echapper(v)}</span>`;
    const connue = estVariableConnue(cle);
    const classes = connue
      ? "rounded-sm bg-amber-100 px-1 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      : "rounded-sm bg-red-100 px-1 font-semibold text-red-700 line-through dark:bg-red-950 dark:text-red-300";
    return `<span class="${classes}">${echapper(cle)}</span>`;
  });
}

/** Convertit le HTML d'un modèle en texte brut, sauts de ligne compris. */
export function versTexte(html: string): string {
  if (typeof document === "undefined") return html;
  const bac = document.createElement("div");
  bac.innerHTML = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n")
    .replace(/<li>/gi, "· ");
  return (bac.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
