import React from 'react';
import { motion } from 'framer-motion';

/**
 * AnimatedImage Component
 * Slices an image into a grid of tiles and animates them into place.
 * 
 * @param {string} src - The URL of the image to display.
 * @param {number} gridSize - The number of tiles per side (default 5 for 5x5).
 */
export default function AnimatedImage({ src, gridSize = 5 }) {
  const tiles = [];

  // Generate grid coordinates
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      tiles.push({ row, col });
    }
  }

  // Animation variants for individual pieces
  const pieceVariants = {
    hidden: () => ({
      opacity: 0,
      scale: 0.8,
      y: Math.random() * 100 - 50, // Random offset between -50 and 50
    }),
    visible: (i) => ({
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.2 + i * 0.04, // Staggered delay per tile
      }
    })
  };

  return (
    <div 
      style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        width: '100%',
        aspectRatio: '16/11', // Optimized for standard illustrations
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {tiles.map((tile, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={pieceVariants}
          initial="hidden"
          animate="visible"
          style={{
            backgroundImage: `url("${src}")`,
            backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
            backgroundPosition: `${(tile.col / (gridSize - 1)) * 100}% ${(tile.row / (gridSize - 1)) * 100}%`,
            width: '100%',
            height: '100%',
            backgroundColor: '#fff' // Fallback
          }}
        />
      ))}
    </div>
  );
}
