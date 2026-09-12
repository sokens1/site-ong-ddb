import React, { useState } from 'react';
import { Globe, Pencil, ExternalLink } from 'lucide-react';
import { SiteContentProvider } from '../../../context/SiteContentContext';
import HomePage from '../../HomePage';
import AboutPage from '../../AboutPage';
import NewsPage from '../../NewsPage';
import EventsPage from '../../EventsPage';
import ActionsPage from '../../ActionsPage';
import JoinPage from '../../JoinPage';
import Footer from '../../../components/Footer';

// Reprend exactement les liens de la vraie navbar du site (Header.tsx), pour
// naviguer entre les pages à éditer de la même façon que sur le site.
type PageId = 'home' | 'about' | 'reports' | 'news' | 'events' | 'join';

const SITE_NAV: { id: PageId; label: string; sitePath: string }[] = [
  { id: 'home', label: 'Accueil', sitePath: '/' },
  { id: 'about', label: 'À propos', sitePath: '/about' },
  { id: 'reports', label: 'Nos rapports', sitePath: '/actions' },
  { id: 'news', label: 'Actualités', sitePath: '/news' },
  { id: 'events', label: 'Nos événements', sitePath: '/events' },
  { id: 'join', label: 'Rejoignez-nous', sitePath: '/join' },
];

type TabId = 'website-content';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'website-content', label: 'Contenu du site web', icon: Globe },
];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('website-content');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">Configuration générale du site.</p>
      </div>

      {/* Onglets — d'autres onglets de paramètres (sans rapport au contenu du site) viendront ici */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'website-content' && <WebsiteContentTab />}
    </div>
  );
};

const WebsiteContentTab: React.FC = () => {
  const [page, setPage] = useState<PageId>('home');
  const current = SITE_NAV.find((p) => p.id === page)!;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 rounded-2xl border border-green-100 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Pencil size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-green-800">Édition en direct</p>
            <p className="text-xs text-green-700/80 mt-0.5">
              Naviguez ci-dessous exactement comme sur le site. Cliquez sur un texte pour le modifier,
              ou sur une image pour la remplacer. Chaque changement est enregistré immédiatement et
              visible par les visiteurs.
            </p>
          </div>
        </div>
        <a
          href={current.sitePath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
        >
          <ExternalLink size={14} />
          Voir la page
        </a>
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        {/* Barre de navigation — reproduit la navbar du site pour changer de page */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2">
          {SITE_NAV.map((p) => (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                page === p.id ? 'bg-ddb-700 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/*
          Toutes les pages sauf Accueil s'attendent à être placées sous la navbar
          flottante du site : elles remontent leur contenu de 96px (-mt-24) pour
          compenser le spacer que Header.tsx insère normalement. Ici il n'y a pas
          de spacer réel, donc on en simule un (pt-24) pour que cette remontée ne
          chevauche pas la barre de navigation ci-dessus.
        */}
        <div className={page !== 'home' ? 'pt-24 overflow-hidden' : ''}>
          <SiteContentProvider editMode>
            <div className="pointer-events-auto">
              {page === 'home' && (
                <>
                  <HomePage />
                  <Footer />
                </>
              )}
              {page === 'about' && <AboutPage />}
              {page === 'reports' && <ActionsPage />}
              {page === 'news' && <NewsPage />}
              {page === 'events' && <EventsPage />}
              {page === 'join' && <JoinPage />}
            </div>
          </SiteContentProvider>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
