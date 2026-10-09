import React, { useState, useEffect } from 'react';
import { Globe, Pencil, ExternalLink, Smartphone, CheckCircle, Save, Loader2, Copy, ShieldCheck } from 'lucide-react';
import { SiteContentProvider } from '../../../context/SiteContentContext';
import HomePage from '../../HomePage';
import AboutPage from '../../AboutPage';
import NewsPage from '../../NewsPage';
import EventsPage from '../../EventsPage';
import ActionsPage from '../../ActionsPage';
import JoinPage from '../../JoinPage';
import Footer from '../../../components/Footer';
import {
  fetchPaymentSettings,
  savePaymentSettings,
  PaymentSettings,
  DEFAULT_PAYMENT_SETTINGS,
} from '../../../utils/paymentSettings';

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

type TabId = 'website-content' | 'payment-settings';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'website-content', label: 'Contenu du site web', icon: Globe },
  { id: 'payment-settings', label: 'Paiements mobiles (Airtel & Moov)', icon: Smartphone },
];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('website-content');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">Configuration générale du site et des moyens de paiement.</p>
      </div>

      {/* Onglets */}
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
      {activeTab === 'payment-settings' && <PaymentSettingsTab />}
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

const PaymentSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testCopied, setTestCopied] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchPaymentSettings().then((res) => {
      if (isMounted) {
        setSettings(res);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field: keyof PaymentSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSavedSuccess(false);
    setSaveError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSavedSuccess(false);

    try {
      const ok = await savePaymentSettings(settings);
      if (ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        setSaveError("Une erreur est survenue lors de l'enregistrement dans la base de données.");
      }
    } catch (err: any) {
      setSaveError(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setTestCopied(label);
    setTimeout(() => setTestCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="animate-spin text-green-600 mb-3" size={36} />
        <p className="text-sm">Chargement des configurations de paiement…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* Introduction */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
          <Smartphone size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-blue-900">
            Comptes marchands Airtel Money & Moov Money
          </h2>
          <p className="text-xs text-blue-800/80 mt-1 leading-relaxed">
            Ces numéros sont présentés aux participants lorsqu'ils réservent des places pour un événement payant.
            L'utilisateur copie le numéro pour effectuer le transfert depuis son application bancaire, puis confirme
            sa transaction sur WhatsApp.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bloc Airtel Money */}
          <div className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-red-100">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full bg-red-600" />
                <h3 className="font-bold text-gray-900 text-lg">Airtel Money Gabon</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                077 / 074
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Numéro affiché (format lisible)
                </label>
                <input
                  type="text"
                  value={settings.airtelNumber}
                  onChange={(e) => handleChange('airtelNumber', e.target.value)}
                  placeholder="+241 77 65 00 15"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">Exemple : +241 77 65 00 15 ou 077 65 00 15</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Numéro brut copié en 1 clic (sans espaces)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.airtelRawNumber}
                    onChange={(e) => handleChange('airtelRawNumber', e.target.value)}
                    placeholder="077650015"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleTestCopy(settings.airtelRawNumber, 'airtel')}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5"
                    title="Tester la copie"
                  >
                    <Copy size={13} />
                    {testCopied === 'airtel' ? 'Copié !' : 'Tester'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Numéro collable directement dans Airtel Money.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nom du titulaire / compte
                </label>
                <input
                  type="text"
                  value={settings.airtelAccountName}
                  onChange={(e) => handleChange('airtelAccountName', e.target.value)}
                  placeholder="ONG DDB"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">Nom affiché sur la confirmation Airtel.</p>
              </div>
            </div>
          </div>

          {/* Bloc Moov Money */}
          <div className="rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full bg-blue-600" />
                <h3 className="font-bold text-gray-900 text-lg">Moov Money Gabon</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                066 / 062
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Numéro affiché (format lisible)
                </label>
                <input
                  type="text"
                  value={settings.moovNumber}
                  onChange={(e) => handleChange('moovNumber', e.target.value)}
                  placeholder="+241 66 12 34 56"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">Exemple : +241 66 12 34 56 ou 066 12 34 56</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Numéro brut copié en 1 clic (sans espaces)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.moovRawNumber}
                    onChange={(e) => handleChange('moovRawNumber', e.target.value)}
                    placeholder="066123456"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleTestCopy(settings.moovRawNumber, 'moov')}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5"
                    title="Tester la copie"
                  >
                    <Copy size={13} />
                    {testCopied === 'moov' ? 'Copié !' : 'Tester'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Numéro collable directement dans Moov Money.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nom du titulaire / compte
                </label>
                <input
                  type="text"
                  value={settings.moovAccountName}
                  onChange={(e) => handleChange('moovAccountName', e.target.value)}
                  placeholder="ONG DDB"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">Nom affiché sur la confirmation Moov.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bloc WhatsApp */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              WA
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Numéro WhatsApp de réception des confirmations</h3>
              <p className="text-xs text-gray-500">
                Les participants sont redirigés vers ce numéro WhatsApp avec un message pré-rempli contenant leurs détails de réservation.
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Numéro international WhatsApp (sans le symbole '+')
            </label>
            <input
              type="text"
              value={settings.whatsappNumber}
              onChange={(e) => handleChange('whatsappNumber', e.target.value)}
              placeholder="241077617776"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Exemple pour le Gabon : <strong>241077617776</strong> ou <strong>24177650015</strong>
            </p>
          </div>
        </div>

        {/* Feedback messages */}
        {savedSuccess && (
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm font-semibold">
            <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
            <span>Les paramètres de paiement ont été enregistrés avec succès et sont immédiatement actifs sur le site !</span>
          </div>
        )}

        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm font-semibold">
            {saveError}
          </div>
        )}

        {/* Bouton de sauvegarde */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save size={16} />
                Enregistrer les paramètres de paiement
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
