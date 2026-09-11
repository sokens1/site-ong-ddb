import React from 'react';
import AboutHero from '../components/AboutHero';
import About from '../components/About';
import Team from '../components/Team';
import Partners from '../components/Partners';

const AboutPage: React.FC = () => {
  return (
    <div id="about">
      <AboutHero />
      <About />
      <Team />
      <Partners />
    </div>
  );
};

export default AboutPage;
