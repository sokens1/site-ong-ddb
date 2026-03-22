import React from 'react';
import Hero from '../components/Hero';
import QuickActions from '../components/QuickActions';
import News from '../components/News';
import EventsSection from '../components/EventsSection';
import CoreReports from '../components/CoreReports';
import Team from '../components/Team';
import Partners from '../components/Partners';

const HomePage: React.FC = () => {
  return (
    <div id="home">
      <Hero />
      <QuickActions />
      <News />
      <EventsSection />
      <CoreReports />
      <Team />
      <Partners />
    </div>
  );
};

export default HomePage;
