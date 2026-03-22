import React, { useState, useEffect, useRef, Key } from 'react';
import { supabase } from '../supabaseClient';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TeamMember {
  id: Key | null | undefined;
  name: string;
  image: string;
  position: string;
  description: string;
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

const TeamCard: React.FC<{ member: TeamMember; index: number; isInView: boolean }> = ({ member, index, isInView }) => {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      transition={{ delay: index * 0.05 }}
      className="flex-shrink-0 w-[240px] md:w-[280px] h-[320px] md:h-[380px] snap-start group"
    >
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm bg-white border border-gray-100 transition-all duration-300 group-hover:shadow-lg">
        {/* Full Image */}
        <img 
          src={member.image} 
          alt={member.name} 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
        />
        
        {/* Very Bottom Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
        
        {/* Info Content - Very bottom left */}
        <div className="absolute inset-x-0 bottom-0 p-4 text-left flex flex-col justify-end">
          <h3 className="text-base font-bold text-white mb-0.5 drop-shadow-sm leading-tight">
            {member.name}
          </h3>
          <p className="text-green-400 font-bold text-[8px] uppercase tracking-wider">
            {member.position}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const Team: React.FC = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('*')
          .order('id', { ascending: true });
        if (!error && data) setTeam(data);
      } catch (err) {
        console.error('Error fetching team:', err);
      }
    };
    fetchTeam();
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.children[0]?.clientWidth || 0;
      const gap = 24; // flex-gap-6
      const newIndex = Math.round(scrollLeft / (cardWidth + gap));
      if (newIndex !== activeIndex) setActiveIndex(newIndex);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  const scrollTo = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 0;
      const gap = 24;
      scrollRef.current.scrollTo({
        left: index * (cardWidth + gap),
        behavior: 'smooth'
      });
    }
  };

  const scrollSide = (direction: 'left' | 'right') => {
    const nextIndex = direction === 'left' ? Math.max(0, activeIndex - 1) : Math.min(team.length - 1, activeIndex + 1);
    scrollTo(nextIndex);
  };

  return (
    <section id="team" ref={sectionRef} className="py-16 bg-gray-50 overflow-hidden">
      <div className="container mx-auto px-4 mb-10 text-center">
        <motion.h2 variants={itemVariants} initial="hidden" animate={isInView ? "visible" : "hidden"} className="text-3xl md:text-4xl font-bold text-green-800 mb-3">
          Notre Bureau Directeur
        </motion.h2>
        <div className="w-16 h-1 bg-green-600 rounded-full mx-auto mb-4"></div>
      </div>

      <div className="container mx-auto px-4 relative group/carousel">
        {/* Navigation Arrows */}
        <button
          onClick={() => scrollSide('left')}
          className="absolute -left-2 md:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-green-700 hover:bg-green-600 hover:text-white transition-all z-20 opacity-0 group-hover/carousel:opacity-100 active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => scrollSide('right')}
          className="absolute -right-2 md:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-green-700 hover:bg-green-600 hover:text-white transition-all z-20 opacity-0 group-hover/carousel:opacity-100 active:scale-95"
        >
          <ChevronRight size={20} />
        </button>

        {/* Carousel Container */}
        <div 
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x pt-2 px-2"
          style={{ scrollBehavior: 'smooth' }}
        >
          {team.map((member, index) => (
            <TeamCard key={member.id as any} member={member} index={index} isInView={isInView} />
          ))}
        </div>

        {/* Pagination Dots (Suspension points) */}
        <div className="flex justify-center gap-2 mt-2 py-4">
          {team.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-green-600 w-4' : 'bg-gray-300'}`}
              aria-label={`Aller au membre ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Admin Login CTA - Resized/Shrunk as requested */}
      <div className="container mx-auto px-4 mt-8 flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="bg-white border border-green-50 rounded-2xl p-6 shadow-sm text-center max-w-sm w-full"
        >
          <p className="text-gray-500 text-xs mb-4 font-medium uppercase tracking-wider">Accès Direction</p>
          <button 
            onClick={() => navigate('/admin/login')}
            className="w-full inline-flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm active:scale-95 text-sm"
          >
            <i className="fas fa-sign-in-alt text-xs"></i> Espace Membre
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default Team;
