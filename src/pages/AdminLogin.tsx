import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft } from 'lucide-react';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Vérifier si l'utilisateur est admin (vous pouvez créer une table admin_users ou utiliser les metadata)
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex flex-col md:flex-row">
      {/* Colonne gauche - Image (desktop uniquement) */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-green-900/20 z-10" />
        <img
          src="/images/page-login.jpg"
          alt="Administration ONG DDB"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-8 lg:p-12 text-white">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            title="Retour à l'accueil"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Retour au site</span>
          </button>

          <div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 drop-shadow-md">
              Espace d’administration
            </h2>
            <p className="text-sm lg:text-base text-white/90 max-w-md">
              Gérez les contenus, les rapports, les actualités et les contributions de l’ONG
              Développement Durable et Bien-Être depuis une interface centralisée.
            </p>
          </div>
        </div>
      </div>

      {/* Colonne droite - Formulaire */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 md:py-0">
        <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8 relative">
          {/* Bouton retour (mobile) */}
          <button
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 flex items-center gap-2 text-gray-500 hover:text-green-600 transition-colors md:hidden"
            title="Retour à l'accueil"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Accueil</span>
          </button>

          <div className="text-center mb-8 mt-4 md:mt-0">
            <h1 className="text-3xl font-bold text-green-800 mb-2">Administration</h1>
            <p className="text-gray-600 text-sm">
              Connectez-vous pour accéder au panneau d'administration
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

