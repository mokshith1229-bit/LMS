import React from 'react';

const BackgroundVideo = () => {
  return (
    <>
      <video
        key={`video_20260504_132353_edit_${Date.now()}`}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: -2,
          opacity: 1,
          pointerEvents: 'none'
        }}
      >
        <source src={`/assets/video_20260504_132353_edit.mp4?v=${Date.now()}`} type="video/mp4" />
      </video>
      
      {/* White color mask overlay for text readability */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          zIndex: -1,
          pointerEvents: 'none'
        }}
      />
    </>
  );
};

export default BackgroundVideo;
