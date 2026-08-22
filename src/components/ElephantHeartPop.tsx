import React from 'react';

interface ElephantHeartPopProps {
  show: boolean;
  position?: { x: number; y: number } | null;
}

const ALIMEDIA_LIKE_HEART_IMAGE = 'https://i.ibb.co/mV3b5VnH/alimedia-like-heart.png';

/**
 * AliMedia Instagram-style Double-Tap Like Animation
 * Uses the exact heart with dark-green elephant icon:
 * https://i.ibb.co/mV3b5VnH/alimedia-like-heart.png
 */
export const ElephantHeartPop: React.FC<ElephantHeartPopProps> = ({ show, position }) => {
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center overflow-hidden"
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: 'translate(-50%, -50%)',
              position: 'absolute',
              width: '160px',
              height: '160px',
            }
          : undefined
      }
    >
      {/* Instagram-style scale/pop effect with exact provided image */}
      <div className="relative animate-instagramHeartPop flex items-center justify-center pointer-events-none select-none">
        <img
          src={ALIMEDIA_LIKE_HEART_IMAGE}
          alt="Like"
          className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] filter transition-all"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
};
