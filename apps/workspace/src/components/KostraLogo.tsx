import React from 'react';

interface KostraLogoProps {
  className?: string;
  variant?: 'monochrome' | 'accent' | 'inverted';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const KostraLogo: React.FC<KostraLogoProps> = ({
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
  const width = showText ? (height * 185) / 32 : (height * 32) / 32;

  const markColor =
    variant === 'accent'
      ? '#2563EB' // Stripe/Linear Blue Accent
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
        viewBox={showText ? '0 0 185 32' : '0 0 32 32'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform group-hover:scale-[1.02]"
      >
        {/* Geometric Vector Mark: 3 nodes connected in 2D/3D simplex */}
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

        {/* Crisp Monospace/Inter Wordmark */}
        {showText && (
          <text
            x="36"
            y="22"
            fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            fontWeight="700"
            fontSize="17"
            letterSpacing="0.03em"
            fill={textColor}
          >
            kostra44SIP
          </text>
        )}
      </svg>
    </div>
  );
};
