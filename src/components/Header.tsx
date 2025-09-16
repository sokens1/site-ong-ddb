import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
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
                <Link
                  to="/"
                  className={`font-medium transition ${
                    isActive('/') 
                      ? 'text-green-600 border-b-2 border-green-600' 
                      : 'text-green-800 hover:text-green-600'
                  }`}
                >
                  Accueil
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className={`font-medium transition ${
                    isActive('/about') 
                      ? 'text-green-600 border-b-2 border-green-600' 
                      : 'text-green-800 hover:text-green-600'
                  }`}
                >
                  L'ONG
                </Link>
              </li>
              <li>
                <Link
                  to="/actions"
                  className={`font-medium transition ${
                    isActive('/actions') 
                      ? 'text-green-600 border-b-2 border-green-600' 
                      : 'text-green-800 hover:text-green-600'
                  }`}
                >
                  Nos actions
                </Link>
              </li>
              <li>
                <Link
                  to="/news"
                  className={`font-medium transition ${
                    isActive('/news') 
                      ? 'text-green-600 border-b-2 border-green-600' 
                      : 'text-green-800 hover:text-green-600'
                  }`}
                >
                  Actualités
                </Link>
              </li>
              <li>
                <Link
                  to="/join"
                  className={`font-medium transition ${
                    isActive('/join') 
                      ? 'text-green-600 border-b-2 border-green-600' 
                      : 'text-green-800 hover:text-green-600'
                  }`}
                >
                  Rejoignez-nous
                </Link>
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
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`block font-medium w-full text-left ${
                  isActive('/') ? 'text-green-600' : 'text-green-800'
                }`}
              >
                Accueil
              </Link>
            </li>
            <li className="py-2 border-b">
              <Link
                to="/about"
                onClick={() => setMobileMenuOpen(false)}
                className={`block font-medium w-full text-left ${
                  isActive('/about') ? 'text-green-600' : 'text-green-800'
                }`}
              >
                L'ONG
              </Link>
            </li>
            <li className="py-2 border-b">
              <Link
                to="/actions"
                onClick={() => setMobileMenuOpen(false)}
                className={`block font-medium w-full text-left ${
                  isActive('/actions') ? 'text-green-600' : 'text-green-800'
                }`}
              >
                Nos actions
              </Link>
            </li>
            <li className="py-2 border-b">
              <Link
                to="/news"
                onClick={() => setMobileMenuOpen(false)}
                className={`block font-medium w-full text-left ${
                  isActive('/news') ? 'text-green-600' : 'text-green-800'
                }`}
              >
                Actualités
              </Link>
            </li>
            <li className="py-2">
              <Link
                to="/join"
                onClick={() => setMobileMenuOpen(false)}
                className={`block font-medium w-full text-left ${
                  isActive('/join') ? 'text-green-600' : 'text-green-800'
                }`}
              >
                Rejoignez-nous
              </Link>
            </li>
          </ul>
        </div>
      )}
    </>
  );
};

export default Header;