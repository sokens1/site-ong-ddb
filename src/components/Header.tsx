import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/about', label: 'À propos' },
  { to: '/actions', label: 'Nos rapports' },
  { to: '/news', label: 'Actualités' },
  { to: '/events', label: 'Nos événements' },
];

const Header: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Referme le menu mobile à chaque changement de page
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`mt-3 flex items-center justify-between gap-4 rounded-full border border-black/5 bg-white/90 px-3 py-2 backdrop-blur-md transition-shadow duration-300 sm:mt-4 sm:px-4 ${
              scrolled ? 'shadow-xl shadow-black/10' : 'shadow-lg shadow-black/5'
            }`}
          >
            {/* Logo */}
            <Link to="/" className="flex shrink-0 items-center">
              <img
                src="/images/logo-ong-DDB.png"
                alt="ONG DDB"
                className="h-10 w-10 object-contain"
              />
            </Link>

            {/* Navigation — desktop */}
            <nav className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        isActive(item.to)
                          ? 'bg-ddb-50 text-ddb-700'
                          : 'text-ddb-900/70 hover:bg-ddb-50 hover:text-ddb-700'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* CTA — desktop */}
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <Link
                to="/join"
                className="rounded-full bg-ddb-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-ddb-700"
              >
                Rejoignez-nous
              </Link>
              {/* TODO: brancher sur une route de don dédiée quand elle existera */}
              <Link
                to="/join"
                className="rounded-full border-2 border-ddb-200 px-5 py-2 text-sm font-bold text-ddb-700 transition-colors hover:border-ddb-400 hover:bg-ddb-50"
              >
                Faire un don
              </Link>
            </div>

            {/* Burger — mobile */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-full p-2 text-ddb-800 transition-colors hover:bg-ddb-50 lg:hidden"
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={open}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </motion.div>

          {/* Menu mobile déroulant */}
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 overflow-hidden rounded-3xl border border-black/5 bg-white p-3 shadow-xl shadow-black/10 lg:hidden"
            >
              <ul className="flex flex-col">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`block rounded-2xl px-4 py-3 text-base font-semibold ${
                        isActive(item.to)
                          ? 'bg-ddb-50 text-ddb-700'
                          : 'text-ddb-900/80 hover:bg-ddb-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-col gap-2 px-1 pb-1">
                <Link
                  to="/join"
                  className="rounded-full bg-ddb-600 px-5 py-3 text-center text-sm font-bold text-white"
                >
                  Rejoignez-nous
                </Link>
                <Link
                  to="/join"
                  className="rounded-full border-2 border-ddb-200 px-5 py-3 text-center text-sm font-bold text-ddb-700"
                >
                  Faire un don
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </header>

      {/* Spacer : pousse le contenu sous la navbar flottante.
          Sur l'accueil, le Hero passe volontairement derrière la navbar. */}
      {!isHome && <div aria-hidden className="h-24" />}
    </>
  );
};

export default Header;
