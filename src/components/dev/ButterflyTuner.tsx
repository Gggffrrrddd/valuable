import { createPortal } from 'react-dom';

interface ButterflyTunerProps {
  shine: number;
  onShine: (v: number) => void;
  size: number;
  onSize: (v: number) => void;
}

export default function ButterflyTuner({ shine, onShine, size, onSize }: ButterflyTunerProps) {
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] w-60 rounded-2xl border border-white/10 bg-black/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,.6)] backdrop-blur-xl">
      <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#c9a24a]">Butterfly thumb tuner</div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold text-stone-300">
        <label htmlFor="bft-shine">Shine</label>
        <span className="font-mono text-stone-500">{shine.toFixed(2)}x</span>
      </div>
      <input
        id="bft-shine"
        type="range"
        min={0.4}
        max={2}
        step={0.05}
        value={shine}
        onChange={(e) => onShine(Number(e.target.value))}
        className="mt-1 w-full accent-[#c9a24a]"
      />
      <div className="mt-3 flex items-center justify-between text-xs font-bold text-stone-300">
        <label htmlFor="bft-size">Size</label>
        <span className="font-mono text-stone-500">{size}%</span>
      </div>
      <input
        id="bft-size"
        type="range"
        min={60}
        max={160}
        step={1}
        value={size}
        onChange={(e) => onSize(Number(e.target.value))}
        className="mt-1 w-full accent-[#c9a24a]"
      />
      <button
        type="button"
        onClick={() => { onShine(1); onSize(100); }}
        className="mt-4 w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-stone-400 transition hover:bg-white/10"
      >
        Reset
      </button>
    </div>,
    document.body,
  );
}
