"use client";

import { useCallback, useEffect, useState } from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/components/AppContext";
import { Button, Modal, Spinner, Textarea, cx } from "@/components/ui";
import { fmtDateTime, fullName } from "@/lib/format";
import type { ContactNote } from "@/lib/types";

/**
 * Fil de commentaires d'un contact, réutilisé partout où l'on croise une
 * personne : sa fiche, la liste des contacts, l'onglet Contacts d'une
 * entreprise. Écrire une note ne doit jamais obliger à changer de page.
 *
 * Une note épinglée remonte en tête et s'affiche en orange : c'est le canal
 * des avertissements — « attendre la validation de Untel », « a quitté
 * l'entreprise mais peut encore ouvrir des portes ».
 */
export function NotesContact({
  contactId, compact, onChange,
}: {
  contactId: string;
  /** Version resserrée, pour un affichage à l'intérieur d'une fenêtre. */
  compact?: boolean;
  onChange?: () => void;
}) {
  const { profile, canWrite, isAdmin } = useApp();
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [brouillon, setBrouillon] = useState("");
  const [epingler, setEpingler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chargement, setChargement] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("contact_notes")
      .select("*, author:profiles(first_name,last_name)")
      .eq("contact_id", contactId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setNotes((data as unknown as ContactNote[]) ?? []);
    setChargement(false);
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  const ajouter = async () => {
    const texte = brouillon.trim();
    if (!texte || !profile) return;
    setBusy(true);
    const { error } = await supabase.from("contact_notes")
      .insert({ contact_id: contactId, author_id: profile.id, body: texte, pinned: epingler });
    setBusy(false);
    if (error) return;
    setBrouillon(""); setEpingler(false);
    load(); onChange?.();
  };

  const basculerEpingle = async (n: ContactNote) => {
    await supabase.from("contact_notes").update({ pinned: !n.pinned }).eq("id", n.id);
    load(); onChange?.();
  };

  const supprimer = async (id: string) => {
    await supabase.from("contact_notes").delete().eq("id", id);
    load(); onChange?.();
  };

  return (
    <div className={compact ? "" : "flex flex-col"}>
      {canWrite && (
        <div className={cx(compact ? "mb-3" : "border-b border-slate-100 p-3 dark:border-slate-800")}>
          <Textarea
            rows={3}
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            placeholder="En attente de la validation de Clara avant d'envoyer. A quitté l'entreprise en juin mais peut nous ouvrir des portes."
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={epingler} onChange={(e) => setEpingler(e.target.checked)}
                className="h-3.5 w-3.5 accent-amber-500" />
              <Pin size={12} className="text-amber-500" />
              Mettre en avant sur la fiche
            </label>
            <Button size="sm" onClick={ajouter} disabled={busy || !brouillon.trim()}>
              {busy ? <Spinner /> : "Ajouter"}
            </Button>
          </div>
        </div>
      )}

      {chargement ? (
        <div className="p-4"><Spinner /></div>
      ) : notes.length === 0 ? (
        <p className={cx("text-center text-xs text-slate-400", compact ? "py-4" : "px-4 py-8")}>
          Aucune note. Notez ici ce qu&apos;il faut savoir avant d&apos;écrire à cette personne.
        </p>
      ) : (
        <ul className={cx("divide-y divide-slate-100 dark:divide-slate-800",
          compact && "max-h-[320px] overflow-y-auto")}>
          {notes.map((n) => (
            <li key={n.id} className={cx("group px-1 py-2.5", !compact && "px-4 py-3",
              n.pinned && "bg-amber-50/70 dark:bg-amber-950/20")}>
              <div className="flex items-start justify-between gap-3">
                <p className={cx("whitespace-pre-wrap text-[13px] leading-relaxed",
                  n.pinned ? "text-amber-900 dark:text-amber-200" : "text-slate-700 dark:text-slate-300")}>
                  {n.pinned && <Pin size={12} className="mr-1 inline text-amber-500" />}
                  {n.body}
                </p>
                <span className="flex shrink-0 gap-0.5">
                  {canWrite && (
                    <button onClick={() => basculerEpingle(n)}
                      title={n.pinned ? "Ne plus mettre en avant" : "Mettre en avant"}
                      aria-label={n.pinned ? "Ne plus mettre en avant" : "Mettre en avant"}
                      className="rounded p-1 text-slate-300 transition hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-950">
                      {n.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                  )}
                  {(n.author_id === profile?.id || isAdmin) && (
                    <button onClick={() => supprimer(n.id)} aria-label="Supprimer la note"
                      className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {fullName(n.author) || "Auteur inconnu"} · {fmtDateTime(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Les notes d'un contact dans une fenêtre, depuis n'importe quelle liste. */
export function ModaleNotesContact({
  open, onClose, contactId, nom, onChange,
}: {
  open: boolean; onClose: () => void; contactId: string | null; nom: string; onChange?: () => void;
}) {
  if (!contactId) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Notes — ${nom}`}>
      <NotesContact contactId={contactId} compact onChange={onChange} />
    </Modal>
  );
}
