import type { FocusVisualProps } from './types';

export default function JarVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const waterY = 233 - value * 126;
  const complete = value >= 1;

  return (
    <svg viewBox="0 0 260 300" className={`focus-visual ${complete ? 'visual-complete' : ''}`} role="img" aria-label={`Water jar ${Math.round(value * 100)} percent complete`}>
      <defs>
        <clipPath id="jarInside"><path d="M78 103H182V220C182 241 165 252 130 252C95 252 78 241 78 220Z" /></clipPath>
        <linearGradient id="jarWater" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dfff9e" /><stop offset="1" stopColor="#86c91f" /></linearGradient>
        <filter id="jarGlow"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>
      <path d="M106 40H166V64H134V81" fill="none" stroke="#b8b8af" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {!complete && <g className="jar-drop"><path d="M134 73C126 84 126 90 134 94C142 90 142 84 134 73Z" fill="#c5ff54" /></g>}
      <g clipPath="url(#jarInside)">
        <rect x="76" y={waterY} width="108" height={260 - waterY} fill="url(#jarWater)" opacity=".78" className="visual-level" />
        <path d={`M75 ${waterY} Q90 ${waterY - 5} 105 ${waterY}T135 ${waterY}T165 ${waterY}T190 ${waterY}`} fill="none" stroke="#eeffd0" strokeWidth="4" className="jar-wave visual-level" />
        <circle cx="105" cy={waterY + 22} r="4" fill="#f5ffe3" opacity=".35" />
        <circle cx="151" cy={waterY + 42} r="3" fill="#f5ffe3" opacity=".25" />
      </g>
      <path d="M78 103H182V220C182 241 165 252 130 252C95 252 78 241 78 220Z" fill="rgba(255,255,255,.025)" stroke="#b8b8af" strokeWidth="5" />
      <path d="M70 103H190" stroke="#f5f3eb" strokeWidth="9" strokeLinecap="round" />
      <path d="M91 119V209" stroke="white" strokeWidth="3" opacity=".12" strokeLinecap="round" />
      <ellipse cx="130" cy="250" rx="58" ry="9" fill="#c5ff54" opacity={complete ? .22 : .04} filter="url(#jarGlow)" className="visual-finish-glow" />
    </svg>
  );
}
