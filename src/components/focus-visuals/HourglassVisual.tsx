import type { FocusVisualProps } from './types';

export default function HourglassVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const topHeight = 78 * (1 - value);
  const moundTop = 232 - 80 * value;
  const complete = value >= 1;

  return (
    <svg viewBox="0 0 260 300" className={`focus-visual ${complete ? 'visual-complete' : ''}`} role="img" aria-label={`Hourglass ${Math.round(value * 100)} percent complete`}>
      <defs>
        <linearGradient id="hourglassSand" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e9ffc0" />
          <stop offset="1" stopColor="#a9ed2f" />
        </linearGradient>
        <filter id="hourglassGlow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <clipPath id="topBulb"><path d="M70 54H190C187 91 166 112 138 139H122C94 112 73 91 70 54Z" /></clipPath>
        <clipPath id="bottomBulb"><path d="M122 151H138C166 178 187 199 190 236H70C73 199 94 178 122 151Z" /></clipPath>
      </defs>

      <g className="visual-finish-glow" filter="url(#hourglassGlow)">
        <ellipse cx="130" cy="240" rx="58" ry="7" fill="#c5ff54" opacity=".16" />
      </g>
      <path d="M64 43H196M64 247H196" stroke="#f5f3eb" strokeWidth="9" strokeLinecap="round" />
      <path d="M76 53C78 91 97 116 122 140C97 164 78 198 76 237M184 53C182 91 163 116 138 140C163 164 182 198 184 237" fill="none" stroke="#969990" strokeWidth="4" strokeLinecap="round" />
      <path d="M83 54H177C174 87 157 108 134 132H126C103 108 86 87 83 54Z" fill="rgba(255,255,255,.025)" />
      <path d="M126 148H134C157 172 174 203 177 236H83C86 203 103 172 126 148Z" fill="rgba(255,255,255,.025)" />

      <g clipPath="url(#topBulb)">
        <rect x="69" y={55 + (78 - topHeight)} width="122" height={topHeight} rx="3" fill="url(#hourglassSand)" className="visual-level" />
        {topHeight > 0 && <ellipse cx="130" cy={55 + (78 - topHeight)} rx={Math.max(6, 45 * (1 - value * .7))} ry="5" fill="#e9ffc0" className="visual-level" />}
      </g>
      <g clipPath="url(#bottomBulb)">
        <path d={`M130 ${moundTop} L${123 - 45 * value} 236 H${137 + 45 * value} Z`} fill="url(#hourglassSand)" className="visual-level" />
      </g>

      {!complete && value > 0 && (
        <g className="hourglass-stream">
          <line x1="130" y1="137" x2="130" y2="185" stroke="#c5ff54" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 7" />
          <circle cx="130" cy="148" r="2.5" fill="#e9ffc0" />
          <circle cx="130" cy="166" r="2" fill="#c5ff54" style={{ animationDelay: '-.45s' }} />
        </g>
      )}
      <circle cx="130" cy="144" r="4" fill="#c5ff54" opacity={complete ? 0 : .8} />
    </svg>
  );
}
