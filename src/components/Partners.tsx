import React from 'react';
import { motion } from 'framer-motion';
import EditableText from './site-content/EditableText';
import EditableImage from './site-content/EditableImage';

interface Partner {
  type: 'image';
  key: string;
  value: string;
  alt: string;
}

const Partners: React.FC = () => {
  const partners: Partner[] = [
    { type: 'image', key: 'partners.logo_1', value: '/images/logo-unicef.png', alt: 'UNICEF Logo' },
    { type: 'image', key: 'partners.logo_2', value: '/images/logo-pnud.png', alt: 'PNUD Logo' },
    { type: 'image', key: 'partners.logo_3', value: '/images/logo-WWF.png', alt: 'WWF Logo' },
    { type: 'image', key: 'partners.logo_4', value: '/images/logo-fondation-lekedi.png', alt: 'Fondation Lekedi Logo' },
  ];

  // Double the partners to create a seamless loop
  const duplicatedPartners = [...partners, ...partners, ...partners];

  return (
    <section id="partners" className="py-16 bg-ddb-50 overflow-hidden border-t border-ddb-100">
      <div className="container mx-auto max-w-6xl px-4 mb-10">
        <div className="text-center">
          <EditableText
            as="h2"
            k="partners.heading"
            fallback="Nos Partenaires"
            multiline={false}
            className="font-heading text-4xl font-extrabold tracking-tight text-ddb-950 sm:text-5xl mb-4"
          />
          <div className="w-16 h-1 bg-ddb-600 rounded-full mx-auto"></div>
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
              className="w-24 h-24 flex-shrink-0 flex items-center justify-center transition-all duration-300 hover:scale-110"
            >
              <EditableImage
                k={partner.key}
                fallback={partner.value}
                alt={partner.alt}
                className="max-w-full max-h-full"
                imgClassName="max-w-full max-h-full object-contain"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Partners;
