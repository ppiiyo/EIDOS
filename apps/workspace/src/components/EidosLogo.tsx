import React from 'react';

interface EidosLogoProps {
  className?: string;
  variant?: 'monochrome' | 'accent' | 'inverted';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const EidosLogo: React.FC<EidosLogoProps> = ({
  className = '',
  variant = 'accent',
  size = 'md',
  showText = true,
}) => {
  const heights = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  const height = heights[size];
  const width = showText ? (height * 120) / 32 : (height * 32) / 32;

  const markColor =
    variant === 'accent'
      ? '#2563EB'
      : variant === 'inverted'
      ? '#FFFFFF'
      : '#0A0A0A';

  const textColor =
    variant === 'inverted'
      ? '#FFFFFF'
      : 'currentColor';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={showText ? '0 0 120 32' : '0 0 32 32'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform group-hover:scale-[1.02]"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="16" r="3.2" fill={markColor} />
          <circle cx="24" cy="8" r="3.2" fill={markColor} />
          <circle cx="24" cy="24" r="3.2" fill={markColor} />
          <path
            d="M8 16L24 8L24 24Z"
            stroke={markColor}
            strokeWidth="1.75"
            fill="none"
            strokeOpacity="0.85"
          />
        </g>

        {showText && (
          <text
            x="36"
            y="22"
            fontFamily="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            fontWeight="700"
            fontSize="18"
            letterSpacing="0.02em"
            fill={textColor}
          >
            Eidos
          </text>
        )}
      </svg>
    </div>
  );
};
