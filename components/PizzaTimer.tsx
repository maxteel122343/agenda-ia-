import React from 'react';

interface PizzaTimerProps {
  total: number;
  remaining: number;
  color: string;
  size?: number;
}

const colorMap: Record<string, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  purple: '#a855f7',
  blue: '#3b82f6',
  green: '#22c55e',
};

const PizzaTimer: React.FC<PizzaTimerProps> = ({ total, remaining, color, size = 60 }) => {
  const radius = size / 2;
  const stroke = radius; // Stroke width equals radius to fill the circle
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  // Calculate progress
  // We want it to "unfill" counter-clockwise.
  // Standard SVG circles draw clockwise. 
  // If we start full and reduce offset, it empties clockwise.
  
  const percentage = Math.max(0, Math.min(1, remaining / (total || 1)));
  const strokeDashoffset = circumference * (1 - percentage);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        height={size}
        width={size}
        className="transform -rotate-90 scale-y-[-1]" // Rotate to start at top, scale Y to flip direction (anti-clockwise visual)
        style={{ overflow: 'visible' }}
      >
        {/* Background circle */}
        <circle
          stroke="#27272a"
          strokeWidth={size}
          r={radius / 2}
          cx={radius}
          cy={radius}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          stroke={colorMap[color] || colorMap.red}
          strokeWidth={size} // Full fill
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s linear' }}
          r={radius / 2}
          cx={radius}
          cy={radius}
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-xs font-mono font-bold drop-shadow-md">
            {formatTime(remaining)}
        </span>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default PizzaTimer;
