import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, Plus, Trash2 } from 'lucide-react';
import EditableText from './site-content/EditableText';
import { useSiteContent } from '../context/SiteContentContext';
import { uploadSiteImage, validateSiteImage } from './site-content/uploadSiteImage';

interface PartnerLogo {
  url: string;
  alt: string;
}

// La liste complète est stockée en JSON sous cette clé de site_content dès que
// l'admin ajoute, remplace ou retire un logo.
const LIST_KEY = 'partners.list';

// Logos affichés tant que la liste n'a jamais été enregistrée. Les clés
// partners.logo_N sont celles de l'ancienne version (4 emplacements fixes) :
// on reprend leur éventuel remplacement pour ne rien perdre.
const DEFAULT_PARTNERS = [
  { key: 'partners.logo_1', url: '/images/logo-unicef.png', alt: 'UNICEF Logo' },
  { key: 'partners.logo_2', url: '/images/logo-pnud.png', alt: 'PNUD Logo' },
  { key: 'partners.logo_3', url: '/images/logo-WWF.png', alt: 'WWF Logo' },
  { key: 'partners.logo_4', url: '/images/logo-fondation-lekedi.png', alt: 'Fondation Lekedi Logo' },
];

// Défilement : chaque logo occupe 96px + 64px de marge ; vitesse d'origine
// (1000px en 35s). Un groupe compte au moins 12 logos pour couvrir un grand
// écran, et il est affiché deux fois : défiler de -50% boucle sans saut.
const ITEM_WIDTH_PX = 160;
const SPEED_PX_PER_S = 1000 / 35;
const MIN_LOGOS_PER_GROUP = 12;

const parseList = (raw: string | null): PartnerLogo[] | null => {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((p) => p && typeof p.url === 'string' && p.url)
      .map((p) => ({ url: p.url, alt: typeof p.alt === 'string' ? p.alt : 'Logo partenaire' }));
  } catch {
    return null;
  }
};

const Partners: React.FC = () => {
  const { getText, getImage, setValue, editMode } = useSiteContent();
  const partners =
    parseList(getText(LIST_KEY)) ??
    DEFAULT_PARTNERS.map((p) => ({ url: getImage(p.key) ?? p.url, alt: p.alt }));

  if (!editMode && partners.length === 0) return null;

  const saveList = (list: PartnerLogo[]) => setValue(LIST_KEY, 'text', JSON.stringify(list));

  return (
    <section id="partners" className="py-16 bg-ddb-50 overflow-hidden border-t border-ddb-100">
      <div className="container mx-auto max-w-6xl px-4 mb-10">
        <div className="text-center">
          <EditableText
            as="h2"
            k="partners.heading"
            fallback="Nos Partenaires"
            multiline={false}
            className="font-heading text-4xl font-extrabold tracking-tight text-ddb-950 sm:text-5xl mb-4"
          />
          <div className="w-16 h-1 bg-ddb-600 rounded-full mx-auto"></div>
        </div>
      </div>

      {editMode ? (
        <PartnersEditor partners={partners} saveList={saveList} />
      ) : (
        <PartnersMarquee partners={partners} />
      )}
    </section>
  );
};

const PartnersMarquee: React.FC<{ partners: PartnerLogo[] }> = ({ partners }) => {
  const repeat = Math.ceil(MIN_LOGOS_PER_GROUP / partners.length);
  const group = Array.from({ length: repeat }, () => partners).flat();
  const track = [...group, ...group];

  return (
    <div className="relative flex whitespace-nowrap overflow-hidden">
      <motion.div
        className="flex items-center"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: (group.length * ITEM_WIDTH_PX) / SPEED_PX_PER_S,
            ease: 'linear',
          },
        }}
      >
        {track.map((partner, index) => (
          <div
            key={index}
            className="w-24 h-24 mr-16 flex-shrink-0 flex items-center justify-center transition-all duration-300 hover:scale-110"
          >
            <img src={partner.url} alt={partner.alt} loading="lazy" className="max-w-full max-h-full object-contain" />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

// Mode édition (Admin > Paramètres > Contenu du site web) : logos à plat,
// plus faciles à cibler que dans le défilement.
const PartnersEditor: React.FC<{
  partners: PartnerLogo[];
  saveList: (list: PartnerLogo[]) => Promise<void>;
}> = ({ partners, saveList }) => {
  // Index du logo en cours d'envoi ; partners.length = nouveau logo.
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetIndex = useRef<number>(0);

  const pickFile = (index: number) => {
    targetIndex.current = index;
    inputRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const invalid = validateSiteImage(file);
    if (invalid) {
      alert(invalid);
      return;
    }
    const index = targetIndex.current;
    setUploadingIndex(index);
    try {
      const url = await uploadSiteImage(file, 'partners.logo');
      const next = [...partners];
      next[index] = { url, alt: file.name.replace(/\.[^.]+$/, '') || 'Logo partenaire' };
      await saveList(next);
    } catch (err) {
      console.error('Erreur upload logo partenaire:', err);
      alert("Erreur lors de l'upload de l'image.");
    } finally {
      setUploadingIndex(null);
    }
  };

  const removeAt = async (index: number) => {
    if (!confirm('Retirer ce logo partenaire du site ?')) return;
    await saveList(partners.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto max-w-6xl px-4">
      <p className="text-center text-xs text-gray-500 mb-6">
        Sur le site, ces logos défilent en continu. Cliquez sur un logo pour le remplacer.
      </p>
      <div className="flex flex-wrap justify-center gap-6">
        {partners.map((partner, index) => (
          <div key={`${partner.url}-${index}`} className="group relative w-32 h-32 rounded-2xl border border-ddb-100 bg-white">
            <button
              type="button"
              onClick={() => pickFile(index)}
              className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl p-3"
              title="Remplacer ce logo"
            >
              <img src={partner.url} alt={partner.alt} className="max-w-full max-h-full object-contain" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100">
                {uploadingIndex === index ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-white">
                    <Camera className="h-6 w-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Changer</span>
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
              title="Retirer ce logo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => pickFile(partners.length)}
          disabled={uploadingIndex !== null}
          className="flex w-32 h-32 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ddb-300 bg-white/60 text-ddb-700 hover:bg-white disabled:opacity-60"
        >
          {uploadingIndex === partners.length ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Plus className="h-6 w-6" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-center leading-tight">Ajouter un partenaire</span>
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />
    </div>
  );
};

export default Partners;
