import React from 'react';
import Hero from '../components/Hero';
import QuickActions from '../components/QuickActions';
import News from '../components/News';

const HomePage: React.FC = () => {
  return (
    <div id="home">
      <Hero />
      <QuickActions />
      <News />
    </div>
  );
};

export default HomePage;
