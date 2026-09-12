import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Facebook, Instagram, Twitter, Phone, Mail } from 'lucide-react';
import Turnstile, { verifySubmission, VERIFY_MESSAGES } from './Turnstile';
import EditableText from './site-content/EditableText';
import EditableImage from './site-content/EditableImage';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      // Vérif serveur : anti-bot + format email + domaine jetable
      const check = await verifySubmission({ token: captchaToken, email, kind: 'newsletter' });
      if (!check.ok) {
        setMessage({ type: 'error', text: VERIFY_MESSAGES[check.reason ?? 'server_error'] || 'Adresse email invalide.' });
        setCaptchaNonce(n => n + 1);
        setIsLoading(false);
        return;
      }

      // Insérer l'email dans la base de données
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert([
          {
            email: email.toLowerCase().trim(),
            source: 'website'
          }
        ]);

      if (error) {
        if (error.code === '23505') { // Erreur de contrainte unique (email déjà existant)
          setMessage({ type: 'error', text: 'Cette adresse email est déjà inscrite à notre newsletter.' });
        } else {
          setMessage({ type: 'error', text: 'Une erreur est survenue. Veuillez réessayer.' });
        }
      } else {
        setMessage({ type: 'success', text: 'Merci ! Vous êtes maintenant inscrit à notre newsletter.' });
        setEmail('');
      }
    } catch (error) {
      console.error('Erreur lors de l\'inscription à la newsletter:', error);
      setMessage({ type: 'error', text: 'Une erreur est survenue. Veuillez réessayer.' });
    } finally {
      setIsLoading(false);
    }
  };

  const quickLinks = [
    { label: 'Accueil', to: '/' },
    { label: 'À propos', to: '/about' },
    { label: 'Nos rapports', to: '/actions' },
    { label: 'Actualités', to: '/news' },
    { label: 'Rejoignez-nous', to: '/join' },
  ];

  const socials = [
    { label: 'Facebook', icon: Facebook, href: '#' },
    { label: 'Instagram', icon: Instagram, href: '#' },
    { label: 'Twitter (X)', icon: Twitter, href: '#' },
  ];

  return (
    <footer className="bg-ddb-900 py-16 text-white">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {/* Marque */}
          <div>
            <div className="flex items-center gap-3">
              <EditableImage
                k="footer.logo"
                fallback="/images/logo-ong-DDB.png"
                alt="ONG DDB"
                className="h-10 w-10 rounded-full bg-white p-1"
                imgClassName="h-full w-full object-contain"
              />
              <span className="font-heading text-lg font-bold">ONG DDB</span>
            </div>
            <EditableText
              as="p"
              k="footer.tagline"
              fallback="ONG Développement Durable et Bien-Être, engagée à former les leaders jeunesse pour la protection de l'environnement et l'avenir de la planète."
              className="mt-4 text-sm leading-relaxed text-white/60"
            />
            <div className="mt-5 space-y-2 text-sm text-white/60">
              <a href="tel:+241077650015" className="flex items-center gap-2 hover:text-white">
                <Phone className="h-4 w-4 shrink-0 text-ddb-300" />
                +241 077 65 00 15
              </a>
              <a href="mailto:ongddb@gmail.com" className="flex items-center gap-2 hover:text-white">
                <Mail className="h-4 w-4 shrink-0 text-ddb-300" />
                ongddb@gmail.com
              </a>
            </div>
          </div>

          {/* Liens utiles */}
          <div>
            <h3 className="font-heading text-base font-bold">Liens utiles</h3>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <button
                    onClick={() => navigate(link.to)}
                    className="text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Suivez-nous */}
          <div>
            <h3 className="font-heading text-base font-bold">Suivez-nous</h3>
            <ul className="mt-4 space-y-2.5">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    aria-label={s.label}
                    className="flex items-center gap-2.5 text-sm text-white/60 transition-colors hover:text-white"
                  >
                    <s.icon className="h-4 w-4 shrink-0" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-heading text-base font-bold">Newsletter</h3>
            <p className="mt-4 text-sm text-white/60">
              Recevez nos actualités directement dans votre boîte email.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="mt-4 flex flex-col gap-3">
              <div className="flex overflow-hidden rounded-lg border border-white/15 bg-white/5 focus-within:border-ddb-400">
                <input
                  type="email"
                  id="newsletter-email"
                  name="email"
                  autoComplete="email"
                  placeholder="Votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none disabled:opacity-50"
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="shrink-0 whitespace-nowrap rounded-md bg-white px-4 py-2 text-sm font-bold text-ddb-950 transition-colors hover:bg-ddb-100 disabled:opacity-50 disabled:cursor-not-allowed m-1"
                >
                  {isLoading ? '...' : "S'abonner"}
                </button>
              </div>

              <Turnstile onToken={setCaptchaToken} resetSignal={captchaNonce} />

              {message && (
                <div
                  className={`rounded-lg p-3 text-xs ${
                    message.type === 'success'
                      ? 'border border-ddb-400/30 bg-ddb-400/10 text-ddb-200'
                      : 'border border-red-400/30 bg-red-400/10 text-red-200'
                  }`}
                >
                  {message.text}
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/40">
          <p>&copy; {new Date().getFullYear()} ONG Développement Durable et Bien-Être. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
