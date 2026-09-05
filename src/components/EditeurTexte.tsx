"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, RemoveFormatting } from "lucide-react";
import { cx } from "@/components/ui";
import { VARIABLES, nettoyerHtml } from "@/lib/modeles";

const COULEURS = [
  { nom: "Bleu ESSEC", valeur: "#1DA1E0" },
  { nom: "Vert", valeur: "#047857" },
  { nom: "Orange", valeur: "#C2410C" },
  { nom: "Rouge", valeur: "#B91C1C" },
  { nom: "Gris", valeur: "#64748B" },
  { nom: "Noir", valeur: "#1E2429" },
];

/**
 * Éditeur de texte enrichi minimal (gras, italique, souligné, couleur) et
 * insertion de variables.
 *
 * Le champ n'est volontairement pas contrôlé par React : réécrire `innerHTML`
 * à chaque frappe replacerait le curseur en début de champ. Le contenu initial
 * est posé une fois, puis chaque saisie est simplement remontée au parent.
 */
export function EditeurTexte({
  valeurInitiale, onChange, cle, hauteur = 260,
}: {
  valeurInitiale: string;
  onChange: (html: string) => void;
  /** Change cette clé pour recharger le contenu (passage à un autre modèle). */
  cle: string;
  hauteur?: number;
}) {
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (zone.current) zone.current.innerHTML = valeurInitiale;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  const remonter = () => {
    if (zone.current) onChange(nettoyerHtml(zone.current.innerHTML));
  };

  /**
   * `styleWithCSS` décide de la forme produite : désactivé, gras et italique
   * donnent `<b>` et `<i>`, qui traversent le nettoyage et le presse-papier
   * sans dommage ; activé, il faut passer par du CSS pour la couleur, que
   * les balises historiques `<font>` ne portent plus.
   */
  const commande = (nom: string, valeur?: string) => {
    zone.current?.focus();
    try { document.execCommand("styleWithCSS", false, nom === "foreColor" ? "true" : "false"); } catch {}
    try { document.execCommand(nom, false, valeur); } catch {}
    remonter();
  };

  const insererVariable = (cleVar: string) => {
    zone.current?.focus();
    try { document.execCommand("insertText", false, `{{${cleVar}}}`); } catch {}
    remonter();
  };

  const Outil = ({ titre, onClick, children }: { titre: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
    >{children}</button>
  );

  return (
    <div className="rounded border border-slate-300 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
        <Outil titre="Gras" onClick={() => commande("bold")}><Bold size={15} /></Outil>
        <Outil titre="Italique" onClick={() => commande("italic")}><Italic size={15} /></Outil>
        <Outil titre="Souligné" onClick={() => commande("underline")}><Underline size={15} /></Outil>

        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />

        {COULEURS.map((c) => (
          <button
            key={c.valeur}
            type="button"
            title={c.nom}
            aria-label={`Couleur ${c.nom}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commande("foreColor", c.valeur)}
            className="h-5 w-5 rounded-sm border border-slate-300 transition-transform hover:scale-110 dark:border-slate-600"
            style={{ backgroundColor: c.valeur }}
          />
        ))}

        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <Outil titre="Effacer la mise en forme" onClick={() => commande("removeFormat")}>
          <RemoveFormatting size={15} />
        </Outil>

        <select
          value=""
          aria-label="Insérer une variable"
          onChange={(e) => { if (e.target.value) insererVariable(e.target.value); e.target.value = ""; }}
          className="ml-auto cursor-pointer rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Insérer une variable…</option>
          {VARIABLES.map((v) => (
            <option key={v.cle} value={v.cle}>{v.label} — {`{{${v.cle}}}`}</option>
          ))}
        </select>
      </div>

      <div
        ref={zone}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Corps du message"
        onInput={remonter}
        onBlur={remonter}
        onPaste={(e) => {
          // On colle en texte brut : sinon la mise en forme d'origine
          // (styles Word, Gmail…) contamine le modèle.
          e.preventDefault();
          const texte = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, texte);
        }}
        style={{ minHeight: hauteur }}
        className={cx(
          "w-full overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none",
          "focus:ring-1 focus:ring-inset focus:ring-brand-500 dark:text-slate-100"
        )}
      />
    </div>
  );
}
