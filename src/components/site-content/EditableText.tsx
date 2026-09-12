import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useSiteContent } from '../../context/SiteContentContext';

interface EditableTextProps {
  /** Clé unique dans site_content, ex: "hero.subtitle". */
  k: string;
  /** Valeur par défaut (utilisée tant qu'aucun override n'existe). */
  fallback: string;
  /** Élément ou composant (motion.h2, 'p', ...) dans lequel rendre le texte. */
  as?: React.ElementType;
  className?: string;
  /** Rendu personnalisé (ex: pour garder une emphase colorée sur le texte par défaut). */
  children?: React.ReactNode;
  /** false pour un input simple plutôt qu'un textarea dans la modale d'édition. */
  multiline?: boolean;
  [key: string]: any;
}

const EditableText: React.FC<EditableTextProps> = ({
  k,
  fallback,
  as: As = 'div',
  className = '',
  children,
  multiline = true,
  ...rest
}) => {
  const { getText, setValue, editMode } = useSiteContent();
  const override = getText(k);
  const content = children !== undefined ? children : (override ?? fallback);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(override ?? fallback);
  const [saving, setSaving] = useState(false);

  if (!editMode) {
    return (
      <As className={className} {...rest}>
        {content}
      </As>
    );
  }

  const handleOpen = (e: React.SyntheticEvent) => {
    // Ce texte peut être imbriqué dans un bouton/lien (ex: un CTA) : sans ça,
    // le clic d'édition déclencherait aussi l'action du parent (navigation...).
    e.preventDefault();
    e.stopPropagation();
    setDraft(override ?? fallback);
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await setValue(k, 'text', draft);
    setSaving(false);
    setOpen(false);
  };

  return (
    <>
      <As
        className={`${className} cursor-pointer rounded-md outline outline-2 outline-offset-4 outline-transparent transition-all hover:outline-ddb-500/60 hover:bg-ddb-500/5`}
        onClick={handleOpen}
        title="Cliquer pour modifier ce texte"
        {...rest}
      >
        {content}
      </As>

      {open && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2 text-ddb-700">
              <Pencil size={16} />
              <p className="text-sm font-bold">Modifier ce texte</p>
            </div>
            <p className="mb-3 font-mono text-[11px] text-gray-400">{k}</p>
            {multiline ? (
              <textarea
                autoFocus
                rows={4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !draft.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditableText;
