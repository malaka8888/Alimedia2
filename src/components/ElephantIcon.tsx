import React from 'react';

interface ElephantIconProps {
  className?: string;
  fill?: boolean;
}

export const ElephantIcon: React.FC<ElephantIconProps> = ({ className = 'w-6 h-6', fill = false }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Back and head contour */}
      <path d="M19 13.5c1.5 0 2.5-.8 2.5-2.2 0-1.8-1.4-3.3-3.2-3.3h-1.8C15.2 5.5 12.8 4 9.5 4 5.5 4 3 6.8 3 11v6a1 1 0 0 0 1 1h2.5v-4h3v4a1 1 0 0 0 1 1h2v-4h2.5v4a1 1 0 0 0 1 1H18a1 1 0 0 0 1-1v-4.5z" />
      {/* Ear contour */}
      <path d="M11 7c2 0 3.5 1.5 3.5 4s-1.5 4-3.5 4" />
      {/* Eye */}
      <circle cx="6.5" cy="8.5" r="0.75" fill="currentColor" />
      {/* Sacred tusks */}
      <path d="M4 14.5c-1.2 0-2 .8-2 2s1.2 1.5 2.5 1.5" />
    </svg>
  );
};
