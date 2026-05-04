import React from 'react';

const BackgroundVideo = () => {
  return (
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
        zIndex: -1,
        opacity: 0.1,
        pointerEvents: 'none'
      }}
    >
      <source src={`/assets/video_20260504_132353_edit.mp4?v=${Date.now()}`} type="video/mp4" />
    </video>
  );
};

export default BackgroundVideo;
