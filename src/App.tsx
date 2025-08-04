import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Stats from './components/Stats';
import Actions from './components/Actions';
import News from './components/News';
import Join from './components/Join';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';

function App() {
  return (
    <div className="bg-gray-50">
      <Header />
      <Hero />
      <About />
      <Stats />
      <Actions />
      <News />
      <Join />
      <Footer />
      <BackToTop />
    </div>
  );
}

export default App;