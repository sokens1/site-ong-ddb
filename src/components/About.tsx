import React, { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { FileText, Eye, Download } from 'lucide-react';
import Missions from './Missions';

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

// Animated Section Component
const AnimatedSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  );
};

const About: React.FC = () => {
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);

  return (
    <section id="about" className="bg-white">
      <div className="container mx-auto px-4 py-20">
        {/* Nos missions */}
        <div className="-mx-4">
          <Missions />
        </div>
      </div>

      {/* Documents statutaires — plein cadre, même vert que la section Actualités */}
      <AnimatedSection className="bg-ddb-900 py-20">
        <div className="container mx-auto px-4">
          <div className="relative mx-auto max-w-3xl sm:px-10">
            {/* Cadre */}
            <motion.div
              variants={itemVariants}
              className="relative rounded-[2rem] border-2 border-white/15 bg-ddb-950 px-6 py-16 text-center sm:px-14"
            >
              <h3 className="font-heading text-3xl font-extrabold text-white sm:text-4xl">
                Statuts et Règlement intérieur
              </h3>
              <p className="mx-auto mt-4 max-w-lg text-white/60">
                Consultez les documents officiels qui définissent les
                objectifs, la structure organisationnelle et les règles de
                fonctionnement de notre ONG Développement Durable et
                Bien-Être.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => setIsDocumentModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-heading font-bold text-ddb-950 transition-all duration-300 hover:-translate-y-0.5"
                >
                  <Eye className="h-4 w-4" />
                  Visualiser le document
                </button>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '/documents/statuts-ong.pdf.pdf';
                    link.download = 'statuts-et-reglement-ong.pdf';
                    link.click();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-6 py-3 font-heading font-bold text-white transition-colors duration-300 hover:border-white hover:bg-white/10"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </button>
              </div>
            </motion.div>

            {/* Fiches document flottantes, aux coins opposés */}
            <motion.div
              initial={{ opacity: 0, y: -10, rotate: 6 }}
              whileInView={{ opacity: 1, rotate: 3 }}
              viewport={{ once: true }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-4 right-2 w-40 rounded-2xl bg-black p-4 shadow-2xl ring-1 ring-white/10 sm:-top-6 sm:right-6 sm:w-48"
            >
              <div className="flex items-center justify-between">
                <FileText className="h-5 w-5 text-ddb-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">PDF</span>
              </div>
              <p className="mt-3 text-sm font-bold text-white">Statuts ONG</p>
              <p className="mt-0.5 text-[11px] text-white/40">01/02/2019</p>
              <div className="mt-4 h-10 rounded-lg bg-gradient-to-r from-ddb-600 via-ddb-400 to-transparent opacity-60 blur-md" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10, rotate: -6 }}
              whileInView={{ opacity: 1, rotate: -3 }}
              viewport={{ once: true }}
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
              className="absolute -bottom-4 left-2 w-40 rounded-2xl bg-black p-4 shadow-2xl ring-1 ring-white/10 sm:-bottom-6 sm:left-6 sm:w-48"
            >
              <div className="flex items-center justify-between">
                <FileText className="h-5 w-5 text-ddb-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">PDF</span>
              </div>
              <p className="mt-3 text-sm font-bold text-white">Règlement intérieur</p>
              <p className="mt-0.5 text-[11px] text-white/40">01/02/2019</p>
              <div className="mt-4 h-10 rounded-lg bg-gradient-to-r from-ddb-500 via-ddb-300 to-transparent opacity-60 blur-md" />
            </motion.div>
          </div>
        </div>
      </AnimatedSection>

      {/* Modal pour visualiser le document */}
      {isDocumentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl h-[95vh] w-full relative flex flex-col">
            {/* En-tête du modal */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-green-800">Statuts et Règlement intérieur</h2>
                <p className="text-green-600 text-sm">Documents officiels de l'ONG</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/documents/statuts-ong.pdf.pdf"
                  download
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors duration-200"
                  title="Télécharger le document"
                >
                  <i className="fas fa-download sm:mr-1"></i>
                  <span className="hidden sm:inline">Télécharger</span>
                </a>
                <button
                  onClick={() => setIsDocumentModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-200"
                  title="Fermer"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Contenu du document */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src="/documents/statuts-ong.pdf.pdf"
                className="w-full h-full border-0"
                title="Statuts et Règlement intérieur"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default About;
