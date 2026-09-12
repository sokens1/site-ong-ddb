import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import Turnstile from '../components/Turnstile';
import { useNoIndex } from '../utils/useNoIndex';

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  missing_fields: 'Merci de renseigner l\'email et le mot de passe.',
  server_error: 'Erreur serveur. Réessayez dans un instant.',
};

// Diaporama du panneau gauche : image + légende défilent ensemble.
const SLIDES = [
  {
    image: '/images/page-login.jpg',
    title: 'Espace d’administration',
    text: 'Gérez les contenus, les rapports, les actualités et les contributions de l’ONG depuis une interface centralisée.',
  },
  {
    image: '/images/image-action-1.jpg',
    title: 'Suivez vos actions de terrain',
    text: 'Événements, inscriptions et rapports d’activité, mis à jour en temps réel pour toute l’équipe.',
  },
  {
    image: '/images/image-presentation-2.jpg',
    title: 'Une équipe, une mission',
    text: 'Coordonnez membres, partenaires et bénévoles autour des objectifs de développement durable au Gabon.',
  },
  {
    image: '/images/page-login1.jpg',
    title: 'Impact mesuré, transparence totale',
    text: 'Chaque don, chaque candidature et chaque rapport reste traçable, du terrain jusqu’au tableau de bord.',
  },
];

const AdminLogin: React.FC = () => {
  useNoIndex();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [slide, setSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Toute la vérification (identifiants + anti brute-force) passe par
      // cette edge function : impossible à contourner depuis le navigateur,
      // contrairement à un simple compteur côté client.
      const { data, error: fnError } = await supabase.functions.invoke('admin-login', {
        body: { email, password, token: captchaToken },
      });

      if (fnError || !data?.ok) {
        const reason: string = data?.reason || 'server_error';
        if (reason === 'locked') {
          const mins = Math.ceil((data?.retryAfterSeconds ?? 0) / 60);
          setError(`Trop de tentatives échouées. Réessayez dans ${mins} minute${mins > 1 ? 's' : ''}.`);
        } else {
          setError(LOGIN_ERROR_MESSAGES[reason] || 'Une erreur est survenue.');
        }
        setCaptchaNonce(n => n + 1);
        setLoading(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) {
        setError('Erreur lors de l\'ouverture de session.');
        setLoading(false);
        return;
      }

      navigate('/espace-ddb');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
      setCaptchaNonce(n => n + 1);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ddb-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-ddb-950/5 lg:grid lg:grid-cols-[3fr_2fr]">
        {/* ── Colonne gauche : diaporama flouté + texte défilant (desktop uniquement) ── */}
        <div className="relative hidden min-h-[600px] overflow-hidden lg:block">
          <AnimatePresence mode="sync">
            <motion.div
              key={slide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0"
            >
              <img
                src={SLIDES[slide].image}
                alt=""
                className="h-full w-full scale-105 object-cover blur-[2px]"
              />
            </motion.div>
          </AnimatePresence>

          {/* Léger voile vert — on garde les photos bien visibles */}
          <div className="absolute inset-0 bg-gradient-to-t from-ddb-950/85 via-ddb-900/25 to-ddb-800/20 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-ddb-950/70 via-transparent to-transparent" />

          <div className="relative z-10 flex h-full flex-col justify-between p-8 text-white lg:p-12">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 self-start rounded-full bg-black/25 px-3.5 py-2 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/35 hover:text-white"
              title="Retour à l'accueil"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium">Retour au site</span>
            </button>

            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h2 className="font-heading text-3xl font-extrabold leading-tight drop-shadow-md lg:text-4xl">
                    {SLIDES[slide].title}
                  </h2>
                  <p className="mt-4 max-w-md text-sm text-white/80 lg:text-base">
                    {SLIDES[slide].text}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex gap-2">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    aria-label={`Diapositive ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === slide ? 'w-8 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Colonne droite : formulaire ── */}
        <div className="flex items-center justify-center px-6 py-10 sm:px-10 sm:py-14">
          <div className="w-full max-w-xs">
            <button
              onClick={() => navigate('/')}
              className="mb-6 inline-flex items-center gap-2 text-ddb-950/50 transition-colors hover:text-ddb-700 lg:hidden"
              title="Retour à l'accueil"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium">Retour à l'accueil</span>
            </button>

            <h1 className="font-heading text-2xl font-extrabold text-ddb-950 sm:text-3xl">
              Bon retour
            </h1>
            <p className="mt-2 text-sm text-ddb-950/50">
              Connectez-vous pour accéder au panneau d'administration.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ddb-950/60">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-ddb-950/10 bg-ddb-50/40 px-4 py-2.5 text-sm text-ddb-950 outline-none transition-colors focus:border-ddb-500 focus:bg-white focus:ring-2 focus:ring-ddb-500/20"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ddb-950/60">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-ddb-950/10 bg-ddb-50/40 px-4 py-2.5 pr-11 text-sm text-ddb-950 outline-none transition-colors focus:border-ddb-500 focus:bg-white focus:ring-2 focus:ring-ddb-500/20"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ddb-950/30 transition-colors hover:text-ddb-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} />

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ddb-700 py-3 font-heading text-sm font-bold text-white transition-colors hover:bg-ddb-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
