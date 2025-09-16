import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ActionsPage from './pages/ActionsPage';
import NewsPage from './pages/NewsPage';
import JoinPage from './pages/JoinPage';
import './index.css';

function App() {
  return (
    <Router>
      <div className="bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/actions" element={<ActionsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/join" element={<JoinPage />} />
        </Routes>
        <Footer />
        <BackToTop />
      </div>
    </Router>
  );
}

export default App;