import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import VideoCard from './VideoCard';
import { fetchVideos, type VideoItem } from '../data/videos';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const CoreVideos: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Toutes');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef(null);
  const isInView = useInView(animationRef, { once: true, margin: '-150px' });

  useEffect(() => {
    const getVideos = async () => {
      const data = await fetchVideos();
      setVideos(data);
    };
    getVideos();
  }, []);

  const extractYear = (v: VideoItem): string | null => {
    const candidates = [v.date, v.created_at].filter(Boolean) as string[];
    for (const c of candidates) {
      const match = c.match(/(20\d{2}|19\d{2})/); // capture 4 chiffres plausibles
      if (match) return match[1];
    }
    return null;
  };

  const years = useMemo(() => {
    const set = new Set<string>();
    videos.forEach(v => {
      const y = extractYear(v);
      if (y) set.add(y);
    });
    return ['Toutes', ...Array.from(set).sort((a, b) => Number(b) - Number(a))];
  }, [videos]);

  const filtered = activeFilter === 'Toutes'
    ? videos
    : videos.filter(v => extractYear(v) === activeFilter);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setActiveFilter(y)}
            className={`btn btn-enhanced px-6 py-2 rounded-full transition-all duration-300 ${
              activeFilter === y
                ? 'bg-green-800 hover:bg-green-700 text-white'
                : 'btn-outline bg-white hover:bg-green-50 text-green-800 border border-green-800'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      <motion.div
        ref={animationRef}
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="relative group"
      >
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-6 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {filtered.map((video) => (
            <motion.div key={video.id} variants={itemVariants} className="flex-shrink-0 snap-start w-96">
              <VideoCard video={video} />
            </motion.div>
          ))}
        </div>

        <button
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 text-green-800 hover:bg-white shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 z-10"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-3 text-green-800 hover:bg-white shadow-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 z-10"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </motion.div>
    </>
  );
};

export default CoreVideos;


