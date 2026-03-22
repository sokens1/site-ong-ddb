import React from 'react';
import { motion } from 'framer-motion';

interface Partner {
  type: 'image';
  value: string;
  alt: string;
}

const Partners: React.FC = () => {
  const partners: Partner[] = [
    { type: 'image', value: '/images/logo-unicef.png', alt: 'UNICEF Logo' },
    { type: 'image', value: '/images/logo-pnud.png', alt: 'PNUD Logo' },
    { type: 'image', value: '/images/logo-WWF.png', alt: 'WWF Logo' },
    { type: 'image', value: '/images/logo-fondation-lekedi.png', alt: 'Fondation Lekedi Logo' },
  ];

  // Double the partners to create a seamless loop
  const duplicatedPartners = [...partners, ...partners, ...partners];

  return (
    <section id="partners" className="py-16 bg-white overflow-hidden border-t border-gray-100">
      <div className="container mx-auto px-4 mb-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-800 mb-2">Nos Partenaires</h2>
          <div className="w-16 h-1 bg-green-600 mx-auto"></div>
        </div>
      </div>

      <div className="relative flex whitespace-nowrap overflow-hidden">
        <motion.div
          className="flex gap-16 items-center px-4"
          animate={{
            x: [0, -1000], // Adjust distance based on content width
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 35, // Requested 35 seconds
              ease: "linear",
            },
          }}
        >
          {duplicatedPartners.map((partner, index) => (
            <div
              key={index}
              className="w-32 h-32 flex-shrink-0 flex items-center justify-center transition-all duration-300 hover:scale-110"
            >
              <img
                src={partner.value}
                alt={partner.alt}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Partners;
