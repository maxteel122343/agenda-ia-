import React from 'react';
import { Connection, CardData } from '../types';

interface ConnectionLayerProps {
  connections: Connection[];
  cards: CardData[];
  connectionStyle?: 'curved' | 'straight';
  strokeWidth?: number;
  showLabels?: boolean;
}

const ConnectionLayer: React.FC<ConnectionLayerProps> = React.memo(({ 
  connections, 
  cards,
  connectionStyle = 'curved',
  strokeWidth = 2,
  showLabels = false
}) => {
  const getCardCenter = (id: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return { x: 0, y: 0 };
    // Assuming card width 256 (w-64) and approx height 300.
    return { x: card.x + 128, y: card.y + 150 };
  };

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#4b5563" />
        </marker>
      </defs>
      {connections.map((conn) => {
        const start = getCardCenter(conn.fromId);
        const end = getCardCenter(conn.toId);
        
        let path = '';
        let midX = 0;
        let midY = 0;

        if (connectionStyle === 'curved') {
             // Bezier curve control logic
             const dx = Math.abs(end.x - start.x) * 0.5;
             path = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
             
             // Calculate midpoint of Cubic Bezier at t=0.5
             // Formula: (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
             // Simplified for t=0.5: 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
             const p0 = start;
             const p1 = { x: start.x + dx, y: start.y };
             const p2 = { x: end.x - dx, y: end.y };
             const p3 = end;

             midX = 0.125 * p0.x + 0.375 * p1.x + 0.375 * p2.x + 0.125 * p3.x;
             midY = 0.125 * p0.y + 0.375 * p1.y + 0.375 * p2.y + 0.125 * p3.y;

        } else {
             // Straight line
             path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
             midX = (start.x + end.x) / 2;
             midY = (start.y + end.y) / 2;
        }

        const labelText = conn.label || conn.id.slice(0, 4);

        return (
          <g key={conn.id}>
            <path
              d={path}
              stroke="#4b5563"
              strokeWidth={strokeWidth}
              fill="none"
              markerEnd="url(#arrowhead)"
              strokeDasharray={strokeWidth > 3 ? "none" : "5,5"} 
              className="opacity-50 transition-all duration-300 ease-in-out"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {showLabels && (
              <g transform={`translate(${midX}, ${midY})`}>
                 <rect 
                    x="-20" 
                    y="-10" 
                    width="40" 
                    height="20" 
                    rx="4" 
                    fill="#18181b" 
                    stroke="#4b5563" 
                    strokeWidth="1"
                    className="opacity-90"
                 />
                 <text
                    x="0"
                    y="0"
                    dy="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#9ca3af"
                    fontSize="10"
                    fontFamily="monospace"
                    className="pointer-events-none select-none"
                 >
                    {labelText}
                 </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
});

export default ConnectionLayer;