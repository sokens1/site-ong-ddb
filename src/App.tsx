import React from 'react';
import Header from './components/Header';
import About from './components/About';
import ReportsAndActions from './components/ReportsAndActions';
import Stats from './components/Stats';
import Join from './components/Join';
import Footer from './components/Footer';
import Hero from './components/Hero';
import BackToTop from './components/BackToTop';
import News from './components/News';
import './index.css';

function App() {
  return (
    <div className="bg-gray-50">
      <Header />
      <Hero />
      <About />
      <Stats />
      <ReportsAndActions />
      <News />
      <Join />
      <Footer />
      <BackToTop />
    </div>
  );
}

export default App;