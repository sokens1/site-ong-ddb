import React from 'react';
import Hero from '../components/Hero';
import Stats from '../components/Stats';

const HomePage: React.FC = () => {
  return (
    <div id="home">
      <Hero />
      <Stats />
    </div>
  );
};

export default HomePage;
