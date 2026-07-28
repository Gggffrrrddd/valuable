import type { FocusVisualProps } from './types';

export default function BookVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const milestone = Math.floor(value * 10);
  const complete = value >= 1;
  const leftStack = 3 + value * 15;
  const rightStack = 18 - value * 15;

  return (
    <svg viewBox="0 0 300 300" className={`focus-visual ${complete ? 'visual-complete book-complete' : ''}`} role="img" aria-label={`Book ${Math.round(value * 100)} percent complete`}>
      <defs><linearGradient id="bookPage" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f5f3eb" /><stop offset="1" stopColor="#c8c6bc" /></linearGradient></defs>
      <circle cx="103" cy="73" r="25" fill="#24271f" stroke="#aaa79c" strokeWidth="3" />
      <path d="M82 70C87 44 119 39 130 62C114 55 98 56 82 70Z" fill="#c5ff54" />
      <path d="M94 99C84 131 84 159 91 191M113 99C126 124 131 149 128 172" fill="none" stroke="#aaa79c" strokeWidth="10" strokeLinecap="round" />
      <path d="M88 127C116 139 136 156 151 178" fill="none" stroke="#d3d0c5" strokeWidth="8" strokeLinecap="round" />
      <path d="M56 211H246M65 217V251M238 217V251" stroke="#77796f" strokeWidth="7" strokeLinecap="round" />
      <g className="book-object" style={{ transformOrigin: '160px 199px' }}>
        <path d="M81 187C110 178 137 181 157 195V220C134 207 108 204 81 211Z" fill="url(#bookPage)" stroke="#9b9c94" strokeWidth="2" />
        <path d="M157 195C179 181 207 178 237 187V211C209 204 181 207 157 220Z" fill="url(#bookPage)" stroke="#9b9c94" strokeWidth="2" />
        <path d={`M84 ${213 + leftStack * .35}C112 ${207 + leftStack * .35} 135 ${211 + leftStack * .35} 157 ${224 + leftStack * .35}`} fill="none" stroke="#c5ff54" strokeWidth={leftStack} opacity=".75" />
        <path d={`M157 ${224 + rightStack * .3}C182 ${210 + rightStack * .3} 209 ${207 + rightStack * .3} 235 ${213 + rightStack * .3}`} fill="none" stroke="#666a60" strokeWidth={rightStack} opacity=".55" />
        {!complete && value > 0 && <path key={milestone} d="M230 187C202 161 177 166 158 195C184 181 205 184 230 195Z" fill="#e7e5db" stroke="#c5ff54" strokeWidth="2" className="book-page-flip" style={{ transformOrigin: '158px 195px' }} />}
      </g>
      <path d="M137 170C153 165 165 171 172 180" fill="none" stroke="#d3d0c5" strokeWidth="7" strokeLinecap="round" className="reader-hand" />
      <g stroke="#969990" strokeWidth="2" opacity=".5"><path d="M101 192L130 198M183 197L218 190" /></g>
      <circle cx="159" cy="207" r="45" fill="none" stroke="#c5ff54" strokeWidth="2" opacity={complete ? .24 : 0} className="visual-finish-glow" />
    </svg>
  );
}
