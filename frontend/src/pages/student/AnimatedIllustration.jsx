import { motion } from 'framer-motion';

const GRID_SIZE = 5; // 5x5 tiles

export default function AnimatedIllustration({ src }) {
  const tiles = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      tiles.push({ row, col });
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.2,
      },
    },
  };

  const tileVariants = {
    hidden: (_i) => {
      // Random directions for pieces to fly in from
      const angle = Math.random() * Math.PI * 2;
      const distance = 500 + Math.random() * 500;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        opacity: 0,
        rotate: Math.random() * 360 - 180,
        scale: 0.5,
      };
    },
    visible: {
      x: 0,
      y: 0,
      opacity: 1,
      rotate: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 70,
        damping: 15,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
        width: '100%',
        maxWidth: '500px',
        aspectRatio: '16/11', // Matches common corporate illustration aspect ratios
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {tiles.map((tile, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={tileVariants}
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
            backgroundPosition: `${(tile.col / (GRID_SIZE - 1)) * 100}% ${(tile.row / (GRID_SIZE - 1)) * 100}%`,
            width: '100%',
            height: '100%',
          }}
        />
      ))}
    </motion.div>
  );
}
