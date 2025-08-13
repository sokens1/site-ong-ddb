import React, { useEffect, useRef } from 'react';
import { useInView, animate } from 'framer-motion';

// Interface for the stat object
interface Stat {
  number: string;
  label: string;
}

// Component for a single animated statistic
const AnimatedStat: React.FC<{ stat: Stat }> = ({ stat }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const number = parseInt(stat.number.replace(/,/g, ''));
  const suffix = stat.number.replace(/[0-9,]/g, '');

  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isInView && countRef.current) {
      const controls = animate(0, number, {
        duration: 2,
        onUpdate(value) {
          if (countRef.current) {
            countRef.current.textContent = Math.round(value).toLocaleString();
          }
        }
      });
      // Cleanup function to stop animation if component unmounts
      return () => controls.stop();
    }
  }, [isInView, number]);

  return (
    <div ref={ref} className="p-6">
      <div className="text-4xl md:text-5xl font-bold mb-2">
        <span ref={countRef}>0</span>{suffix}
      </div>
      <div className="text-xl">{stat.label}</div>
    </div>
  );
};

const Stats: React.FC = () => {
  const stats: Stat[] = [
    { number: '100+', label: 'Clubs verts créés' },
    { number: '200K+', label: 'Élèves sensibilisés' },
    { number: '30', label: 'Pêcheurs formés' },
    { number: '3', label: 'Axe d\'action principaux' }
  ];

  return (
    <section className="py-16 bg-green-800 text-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <AnimatedStat key={index} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;