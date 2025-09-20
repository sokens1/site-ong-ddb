import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      // Vérifier si l'email est valide
      if (!email || !email.includes('@')) {
        setMessage({ type: 'error', text: 'Veuillez entrer une adresse email valide.' });
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


  return (
    <footer className="bg-green-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4"> ONG DDB </h3>
            <p className="mb-4">
              ONG Développement Durable et Bien-Être, engagé à former les leaders jeunesse pour la protection de l'environnement et l'avenir de la planète.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-white hover:text-green-300">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="#" className="text-white hover:text-green-300">
                <i className="fab fa-twitter"></i>
              </a>
              <a href="#" className="text-white hover:text-green-300">
                <i className="fab fa-instagram"></i>
              </a>
              <a href="#" className="text-white hover:text-green-300">
                <i className="fab fa-linkedin-in"></i>
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Contact</h3>
            <address className="not-italic">
              {/* <p className="mb-2">
                <i className="fas fa-map-marker-alt mr-2"></i>
                Kalikak, Libreville-Gabon
              </p> */}
              <p className="mb-2">
                <i className="fas fa-phone-alt mr-2"></i>
                +241 077 65 00 15
              </p>
              <p className="mb-2">
                <i className="fas fa-phone-alt mr-2"></i>
                +241 074 26 70 78
              </p>
              <p className="mb-2">
                <i className="fas fa-envelope mr-2"></i>
                ongddb@gmail.com
              </p>
            </address>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Liens rapides</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-green-300 transition text-left"
                >
                  Accueil
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/about')}
                  className="hover:text-green-300 transition text-left"
                >
                  À propos
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/actions')}
                  className="hover:text-green-300 transition text-left"
                >
                  Nos actions
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/news')}
                  className="hover:text-green-300 transition text-left"
                >
                  Actualités
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/join')}
                  className="hover:text-green-300 transition text-left"
                >
                  Rejoignez-nous
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Newsletter</h3>
            <p className="mb-4">Recevez nos actualités directement dans votre boîte email</p>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Votre email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600 text-gray-800 disabled:opacity-50"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-enhanced text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Inscription...
                  </span>
                ) : (
                  'S\'abonner'
                )}
              </button>
              
              {/* Messages de succès/erreur */}
              {message && (
                <div className={`p-3 rounded text-sm ${
                  message.type === 'success' 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {message.text}
                </div>
              )}
            </form>
          </div>
        </div>
        <div className="border-t border-green-800 mt-8 pt-8 text-center">
          <p>&copy; 2023 ONG Développement Durable et Bien-Être. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;