import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Member {
  id: string | number;
  name: string;
  image: string;
  position: string;
  description?: string;
}

const Team: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const n = members.length;

  // Position "virtuelle" non bornée : le ruban est triplé (3 x membres) et on
  // recentre discrètement (sans animation) dès qu'on sort de la copie du
  // milieu -> défilement infini, jamais de vide en fin de liste.
  const [pos, setPos] = useState(0);
  const [skipAnim, setSkipAnim] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('id, name, image, position, description')
          .order('id', { ascending: true });
        if (!error && data) setMembers(data as Member[]);
      } catch (err) {
        console.error('Error fetching team:', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (n > 0) setPos(n);
  }, [n]);

  const next = () => setPos((p) => p + 1);
  const prev = () => setPos((p) => p - 1);

  // Défilement automatique, en pause au survol
  useEffect(() => {
    if (n < 2 || hovering) return;
    const t = setInterval(next, 4500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, hovering, pos]);

  // Recentrage silencieux quand on sort de la copie du milieu du ruban
  useEffect(() => {
    if (n === 0) return;
    if (pos >= 2 * n || pos < n) {
      const id = setTimeout(() => {
        setSkipAnim(true);
        setPos(n + (((pos % n) + n) % n));
        requestAnimationFrame(() => requestAnimationFrame(() => setSkipAnim(false)));
      }, 720);
      return () => clearTimeout(id);
    }
  }, [pos, n]);

  if (n === 0) return null;

  const strip = [...members, ...members, ...members];

  // Largeur de carte fixe -> le décalage se traduit par un vrai défilement
  const CARD_W = 176;
  const GAP = 20;
  const STEP = CARD_W + GAP;

  return (
    <section id="team" className="bg-white py-20 text-ddb-950 sm:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-14">
          {/* ── Colonne gauche : titre + sous-titre ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10 lg:mb-0"
          >
            <h2 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
              Notre Bureau Directeur
            </h2>
            <p className="mt-3 text-ddb-950/60">
              Des décennies d'expérience combinées, au service d'une même
              mission : agir pour l'environnement au Gabon.
            </p>
            <button
              onClick={() => navigate('/join')}
              className="mt-6 inline-flex rounded-full bg-ddb-700 px-8 py-3.5 font-heading font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-ddb-800"
            >
              Rejoignez-nous
            </button>
          </motion.div>

          {/* ── Colonne droite : carrousel ── */}
          <div>
            {/* Bande de portraits — défilement autonome, nom + fonction sous chaque photo */}
            <div
              className="overflow-hidden"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              <motion.div
                className="flex"
                style={{ gap: GAP }}
                animate={{ x: -pos * STEP }}
                transition={{ duration: skipAnim ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                {strip.map((m, k) => {
                  const dist = Math.abs(k - pos);
                  const on = dist === 0;
                  return (
                    <div key={`${m.id}-${k}`} style={{ width: CARD_W }} className="shrink-0">
                      <button
                        onClick={() => setPos(k)}
                        aria-label={m.name}
                        className={`relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-ddb-50 ring-1 ring-black/5 ${
                          on ? 'ring-2 ring-ddb-400' : ''
                        }`}
                      >
                        <img
                          src={m.image}
                          alt={m.name}
                          className="h-full w-full object-cover transition-all duration-500"
                          style={{
                            filter: on ? 'none' : 'grayscale(1)',
                            opacity: on ? 1 : Math.max(0.18, 1 - dist * 0.2),
                          }}
                        />
                        {!on && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0"
                            style={{
                              backgroundImage:
                                'radial-gradient(#16a34a 1px, transparent 1.5px)',
                              backgroundSize: `${6 + dist * 2}px ${6 + dist * 2}px`,
                              opacity: Math.min(0.85, 0.25 + dist * 0.16),
                              mixBlendMode: 'multiply',
                            }}
                          />
                        )}
                      </button>

                      {/* Nom + fonction, sous la photo (jamais tronqués) */}
                      <div className="mt-3">
                        <p
                          className={`font-heading text-xs font-bold leading-snug sm:text-sm ${
                            on ? 'text-ddb-950' : 'text-ddb-950/25'
                          }`}
                        >
                          {m.name}
                        </p>
                        <p
                          className={`mt-0.5 text-[10px] font-semibold uppercase leading-snug tracking-wide sm:text-[11px] ${
                            on ? 'text-ddb-600' : 'text-ddb-950/15'
                          }`}
                        >
                          {m.position}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </div>

            {/* Navigation, en bas — mêmes icônes sur mobile et desktop.
                Style inline (pas une classe Tailwind) pour le positionnement/z-index :
                ça ne dépend d'aucune génération JIT et passe donc toujours au-dessus
                du bouton flottant "Retour en haut" (fixed, z-index:1000). */}
            <div
              className="mt-5 flex items-center justify-end gap-3"
              style={{ position: 'relative', zIndex: 2000 }}
            >
              <button
                onClick={() => {
                  setHovering(true);
                  prev();
                }}
                aria-label="Précédent"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-ddb-600 text-white shadow-lg transition-colors hover:bg-ddb-700"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => {
                  setHovering(true);
                  next();
                }}
                aria-label="Suivant"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-ddb-600 text-white shadow-lg transition-colors hover:bg-ddb-700"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Team;
