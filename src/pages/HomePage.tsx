import React from 'react';
import Hero from '../components/Hero';
import Missions from '../components/Missions';
import News from '../components/News';
import EventsSection from '../components/EventsSection';
import CoreReports from '../components/CoreReports';
import Team from '../components/Team';
import Partners from '../components/Partners';

const HomePage: React.FC = () => {
  return (
    <div id="home">
      <Hero />
      <Missions />
      <News />
      <EventsSection />
      <CoreReports />
      <Team />
      <Partners />
    </div>
  );
};

export default HomePage;
