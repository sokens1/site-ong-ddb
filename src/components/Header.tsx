import React, { useState } from 'react';

const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/images/logo-ong-DDB.png" alt="ONG DDB Logo" className="w-16 h-16 mr-3" />

          </div>
          <nav className="hidden md:block">
            <ul className="flex space-x-8">
              <li>
                <button
                  onClick={() => scrollToSection('home')}
                  className="text-green-800 font-medium hover:text-green-600 transition"
                >
                  Accueil
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('about')}
                  className="text-green-800 font-medium hover:text-green-600 transition"
                >
                  L'ONG
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('actions')}
                  className="text-green-800 font-medium hover:text-green-600 transition"
                >
                  Nos actions
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('news')}
                  className="text-green-800 font-medium hover:text-green-600 transition"
                >
                  Actualités
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('join')}
                  className="text-green-800 font-medium hover:text-green-600 transition"
                >
                  Rejoignez-nous
                </button>
              </li>
            </ul>
          </nav>
          <button className="md:hidden text-green-800" onClick={toggleMobileMenu}>
            <i className="fas fa-bars text-2xl"></i>
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="bg-white shadow-lg md:hidden">
          <ul className="py-4 px-4">
            <li className="py-2 border-b">
              <button
                onClick={() => scrollToSection('home')}
                className="block text-green-800 font-medium w-full text-left"
              >
                Accueil
              </button>
            </li>
            <li className="py-2 border-b">
              <button
                onClick={() => scrollToSection('about')}
                className="block text-green-800 font-medium w-full text-left"
              >
                L'ONG
              </button>
            </li>
            <li className="py-2 border-b">
              <button
                onClick={() => scrollToSection('actions')}
                className="block text-green-800 font-medium w-full text-left"
              >
                Nos actions
              </button>
            </li>
            <li className="py-2 border-b">
              <button
                onClick={() => scrollToSection('news')}
                className="block text-green-800 font-medium w-full text-left"
              >
                Actualités
              </button>
            </li>
            <li className="py-2">
              <button
                onClick={() => scrollToSection('join')}
                className="block text-green-800 font-medium w-full text-left"
              >
                Rejoignez-nous
              </button>
            </li>
          </ul>
        </div>
      )}
    </>
  );
};

export default Header;