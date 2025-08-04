import React, { useState } from 'react';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter subscription
    setEmail('');
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-green-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">DDBE Gabon</h3>
            <p className="mb-4">
              ONG Développement Durable et Bien-Être, engagée pour la protection de l'environnement et l'éducation au développement durable au Gabon.
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
              <p className="mb-2">
                <i className="fas fa-map-marker-alt mr-2"></i>
                Kalikak, Libreville-Gabon
              </p>
              <p className="mb-2">
                <i className="fas fa-phone-alt mr-2"></i>
                +241 077 65 00 15
              </p>
              <p className="mb-2">
                <i className="fas fa-phone-alt mr-2"></i>
                +241 062 15 95 20
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
                  onClick={() => scrollToSection('home')}
                  className="hover:text-green-300 transition text-left"
                >
                  Accueil
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('about')}
                  className="hover:text-green-300 transition text-left"
                >
                  L'ONG
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('actions')}
                  className="hover:text-green-300 transition text-left"
                >
                  Nos actions
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('news')}
                  className="hover:text-green-300 transition text-left"
                >
                  Actualités
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('join')}
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
                className="px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600 text-gray-800"
              />
              <button
                type="submit"
                className="btn btn-primary btn-enhanced text-white font-bold py-2 px-4 rounded"
              >
                S'abonner
              </button>
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