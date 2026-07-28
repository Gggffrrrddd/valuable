import type { FocusVisualProps } from './types';

const leaves = Array.from({ length: 24 }, (_, index) => {
  const row = Math.floor(index / 6);
  const column = index % 6;
  return { x: 62 + column * 27 + (row % 2) * 8, y: 58 + row * 29 + Math.sin(index * 2.1) * 8, rotate: (index * 47) % 80 - 40 };
});

export default function TreeVisual({ progress }: FocusVisualProps) {
  const value = Math.max(0, Math.min(1, progress));
  const shedCount = Math.floor(value * leaves.length);
  const complete = value >= 1;

  return (
    <svg viewBox="0 0 260 300" className={`focus-visual ${complete ? 'visual-complete' : ''}`} role="img" aria-label={`Tree ${Math.round(value * 100)} percent complete`}>
      <defs><filter id="treeGlow"><feGaussianBlur stdDeviation="8" /></filter></defs>
      <ellipse cx="130" cy="250" rx="62" ry="10" fill="#c5ff54" opacity={complete ? .22 : .05} className="visual-finish-glow" filter="url(#treeGlow)" />
      <g fill="none" stroke="#b5aa95" strokeLinecap="round" strokeLinejoin="round">
        <path d="M130 244C125 207 136 174 130 118" strokeWidth="13" />
        <path d="M128 189C105 166 86 152 66 147M132 172C153 148 172 135 194 126M130 149C109 124 94 106 78 88M132 137C150 111 163 91 179 73" strokeWidth="6" />
        <path d="M103 164L94 128M158 143L169 107M97 111L116 89M163 101L148 80" strokeWidth="4" />
      </g>
      {leaves.map((leaf, index) => {
        const shed = index < shedCount;
        return (
          <g key={index} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rotate})`}>
            <path d="M0 0C8-10 19-7 20 3C12 11 3 9 0 0Z" fill={index % 3 === 0 ? '#e0ff9c' : '#c5ff54'} className={shed ? 'tree-leaf tree-leaf-shed' : 'tree-leaf'} style={{ animationDelay: `${(index % 5) * -.12}s` }} />
          </g>
        );
      })}
      <path d="M79 249C105 239 153 240 182 250" fill="none" stroke="#6e725f" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
