import React from 'react';
import About from '../components/About';
import Team from '../components/Team';
import Partners from '../components/Partners';

const AboutPage: React.FC = () => {
  return (
    <div id="about">
      <About />
      <Team />
      <Partners />
    </div>
  );
};

export default AboutPage;
