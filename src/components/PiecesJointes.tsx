"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileText, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";
import { Button, Spinner } from "@/components/ui";
import type { TemplateFile } from "@/lib/types";

const TAILLE_MAX = 10_000_000; // 10 Mo

const poids = (o: number | null) => {
  if (!o) return "";
  return o > 1_000_000 ? `${(o / 1_000_000).toFixed(1)} Mo` : `${Math.round(o / 1000)} ko`;
};

/**
 * Documents rattachés à un modèle de message : plaquette de présentation,
 * programme du voyage, lettre de recommandation.
 *
 * Deux usages, et un seul est possible techniquement pour chacun : un PDF
 * s'attache à un email après téléchargement, il ne se colle pas dans le corps
 * du message. Le bouton « Copier le lien » sert à cela — on colle une adresse,
 * pas un fichier.
 */
export function PiecesJointes({ templateId }: { templateId: string }) {
  const { isAdmin, profile } = useApp();
  const [fichiers, setFichiers] = useState<TemplateFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("template_files")
      .select("*").eq("template_id", templateId).order("created_at");
    setFichiers((data as TemplateFile[]) ?? []);
  }, [templateId]);

  useEffect(() => { load(); }, [load]);

  const lienPublic = (chemin: string) =>
    supabase.storage.from("documents").getPublicUrl(chemin).data.publicUrl;

  const envoyer = async (fichier: File) => {
    if (fichier.size > TAILLE_MAX) {
      setErreur(`« ${fichier.name} » dépasse 10 Mo. Compressez-le ou hébergez-le ailleurs.`);
      return;
    }
    setBusy(true); setErreur(null);
    const ext = (fichier.name.split(".").pop() || "pdf").toLowerCase();
    const chemin = `${templateId}/${crypto.randomUUID()}.${ext}`;
    const { error: e1 } = await supabase.storage.from("documents")
      .upload(chemin, fichier, { contentType: fichier.type || "application/pdf" });
    if (e1) { setBusy(false); setErreur(e1.message); return; }
    const { error: e2 } = await supabase.from("template_files").insert({
      template_id: templateId, name: fichier.name, path: chemin,
      size_bytes: fichier.size, mime: fichier.type || null, created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (e2) { setErreur(e2.message); return; }
    load();
  };

  const supprimer = async (f: TemplateFile) => {
    if (!window.confirm(`Supprimer « ${f.name} » ? Le lien déjà envoyé cessera de fonctionner.`)) return;
    await supabase.storage.from("documents").remove([f.path]);
    await supabase.from("template_files").delete().eq("id", f.id);
    load();
  };

  const copierLien = async (f: TemplateFile) => {
    try { await navigator.clipboard.writeText(lienPublic(f.path)); } catch {}
    setCopie(f.id);
    window.setTimeout(() => setCopie(null), 2000);
  };

  if (!isAdmin && fichiers.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label">Pièces jointes</p>
        {isAdmin && (
          <>
            <input ref={champ} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => { const fi = e.target.files?.[0]; if (fi) envoyer(fi); e.target.value = ""; }} />
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => champ.current?.click()}>
              {busy ? <Spinner /> : <><Upload size={13} /> Ajouter un document</>}
            </Button>
          </>
        )}
      </div>

      {erreur && (
        <p className="mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {erreur}
        </p>
      )}

      {fichiers.length === 0 ? (
        <p className="text-[11.5px] text-slate-400">
          Aucun document. Ajoutez la plaquette de la promo ou le programme du voyage :
          chacun pourra le joindre à son email sans avoir à le chercher.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {fichiers.map((f) => (
            <li key={f.id}
              className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-2.5 py-2 dark:border-slate-800">
              <FileText size={15} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700 dark:text-slate-200">
                {f.name}
                <span className="ml-1.5 text-[11px] text-slate-400">{poids(f.size_bytes)}</span>
              </span>
              <a href={lienPublic(f.path)} download={f.name} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Download size={12} /> Télécharger
              </a>
              <Button size="sm" variant="ghost" onClick={() => copierLien(f)}>
                {copie === f.id ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier le lien</>}
              </Button>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 dark:text-red-400"
                  onClick={() => supprimer(f)} aria-label="Supprimer le document">
                  <Trash2 size={12} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
        Un PDF ne se colle pas dans le corps d&apos;un email : téléchargez-le pour le joindre,
        ou copiez son lien pour l&apos;insérer dans le texte. Le lien est public — n&apos;y mettez
        rien de confidentiel.
      </p>
    </div>
  );
}
