import React, { useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Leaf } from 'lucide-react';
import { fetchReports } from '../data/reports';
import { useSiteContent } from '../context/SiteContentContext';
import EditableText from './site-content/EditableText';

interface Report {
  id: number;
  title: string;
  description: string;
  fileUrl: string;
  date: string;
  image: string;
  category: string;
}

// Éventail des documents : décalage horizontal, rotation, z-index,
// position "sortie" (ty) et réglages de la boucle sortie / rentrée.
const FAN = [
  { ml: '-ml-20 sm:-ml-28', rot: '-rotate-[14deg]', zi: 10, ty: 6, dur: 3.4, delay: 0 },
  { ml: 'ml-0', rot: 'rotate-0', zi: 16, ty: -14, dur: 3.8, delay: 0.9 },
  { ml: 'ml-20 sm:ml-28', rot: 'rotate-[14deg]', zi: 10, ty: 6, dur: 3.6, delay: 1.8 },
];

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const CoreReports: React.FC = () => {
  const navigate = useNavigate();
  const { getText } = useSiteContent();
  const headingOverride = getText('reports_home.heading');
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    (async () => {
      const data = await fetchReports();
      const sorted = (data as Report[]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setReports(sorted.slice(0, 3));
    })();
  }, []);

  const docs = [0, 1, 2].map((i) => {
    const r = reports[i];
    return { title: r?.title, href: r?.fileUrl };
  });

  return (
    <section id="reports" className="bg-white py-20 sm:py-24">
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="container mx-auto flex max-w-6xl flex-col-reverse items-center gap-16 px-4 lg:flex-row lg:justify-center lg:gap-20"
      >
        {/* ── Sac écologique + documents (gauche) ── */}
        <motion.div
          variants={item}
          className="relative h-[440px] w-full max-w-sm shrink-0 sm:h-[500px] lg:w-[420px]"
        >
          {/* Documents qui sortent / rentrent dans le sac */}
          {docs.map((doc, i) => {
            const f = FAN[i];
            return (
              <div
                key={i}
                className={`absolute left-[54%] top-9 -translate-x-1/2 ${f.rot} ${f.ml}`}
                style={{ zIndex: f.zi }}
              >
                <motion.a
                  href={doc.href || '#'}
                  target={doc.href ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  aria-label={doc.title || 'Ouvrir le rapport'}
                  animate={{ y: [150, f.ty, 150] }}
                  transition={{
                    duration: f.dur,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: f.delay,
                    repeatDelay: 0.5,
                  }}
                  whileHover={{ y: f.ty - 16, scale: 1.03 }}
                  className="relative block h-56 w-40 overflow-hidden rounded-lg bg-white shadow-2xl shadow-ddb-950/25 ring-1 ring-black/5 sm:h-64 sm:w-44"
                >
                  {/* bandeau haut du document */}
                  <div className="h-1.5 w-full bg-ddb-500" />
                  <div className="p-3.5">
                    <FileText className="h-5 w-5 text-ddb-600" />
                    <p className="mt-2 line-clamp-2 font-heading text-[11px] font-bold leading-snug text-ddb-950 sm:text-xs">
                      {doc.title || "Rapport d'activité"}
                    </p>
                    {/* fausses lignes de texte */}
                    <div className="mt-3 space-y-1.5">
                      <span className="block h-1.5 w-full rounded bg-ddb-950/10" />
                      <span className="block h-1.5 w-[85%] rounded bg-ddb-950/10" />
                      <span className="block h-1.5 w-[70%] rounded bg-ddb-950/10" />
                      <span className="block h-1.5 w-[92%] rounded bg-ddb-950/10" />
                      <span className="block h-1.5 w-[60%] rounded bg-ddb-950/10" />
                    </div>
                  </div>
                  <span className="absolute bottom-2.5 left-3.5 rounded bg-ddb-100 px-1.5 py-0.5 font-heading text-[9px] font-bold text-ddb-700">
                    PDF
                  </span>
                </motion.a>
              </div>
            );
          })}

          {/* Le sac */}
          <div className="absolute bottom-4 left-12 right-8 z-20 h-[190px] sm:left-14 sm:right-9 sm:h-[220px]">
            {/* Anses */}
            <div className="absolute -top-11 left-[20%] h-12 w-9 rounded-t-full border-[7px] border-b-0 border-ddb-700 sm:-top-12 sm:h-14 sm:w-11" />
            <div className="absolute -top-11 right-[20%] h-12 w-9 rounded-t-full border-[7px] border-b-0 border-ddb-700 sm:-top-12 sm:h-14 sm:w-11" />

            {/* Corps du sac */}
            <div className="absolute inset-0 overflow-hidden rounded-b-[2rem] rounded-t-lg bg-gradient-to-b from-ddb-500 to-ddb-700 shadow-2xl shadow-ddb-950/30">
              {/* rabat / ouverture */}
              <div className="absolute inset-x-0 top-0 h-6 bg-ddb-800/50" />
              <div className="absolute inset-x-0 top-6 h-px bg-white/20" />
              {/* coutures verticales */}
              <div className="absolute bottom-6 left-1/3 top-10 w-px bg-white/15" />
              <div className="absolute bottom-6 right-1/3 top-10 w-px bg-white/15" />
              {/* emblème */}
              <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-white/90">
                <Leaf className="h-9 w-9" />
                <span className="font-heading text-[10px] font-bold uppercase tracking-[0.2em]">
                  ONG&nbsp;DDB
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Texte (droite) ── */}
        <div className="flex max-w-xl flex-col items-center text-center lg:ml-6 lg:items-start lg:text-left">
          <EditableText
            as={motion.h2}
            k="reports_home.heading"
            fallback="Transparence et impact mesuré"
            variants={item}
            className="font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-ddb-950 sm:text-5xl lg:text-6xl"
          >
            {headingOverride ?? (
              <>
                Transparence et
                <span className="text-ddb-600"> impact mesuré</span>
              </>
            )}
          </EditableText>

          <EditableText
            as={motion.p}
            k="reports_home.subheading"
            fallback="Consultez nos rapports d'activité pour suivre concrètement l'impact de nos actions sur le terrain, année après année."
            variants={item}
            className="mt-6 max-w-md text-lg text-ddb-950/60"
          />

          <motion.div variants={item} className="mt-8">
            <button
              onClick={() => navigate('/actions')}
              className="group inline-flex items-center gap-2 rounded-full bg-ddb-700 px-8 py-3.5 font-heading font-bold text-white shadow-lg shadow-ddb-950/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ddb-800"
            >
              <EditableText k="reports_home.cta" fallback="Consulter tous les rapports" as="span" multiline={false} />
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default CoreReports;
