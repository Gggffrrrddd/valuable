import { useRef, useState } from 'react';
import BladeVisual from '@/components/focus-visuals/BladeVisual';

export default function Test3DBlade() {
  const [scale, setScale] = useState(1);
  const lastLoggedRef = useRef(0);
  const handleCalibration = (snapshot: { scaleMultiplier: number; baseScale: number; effectiveScale: number; baseLargestDimension: number; effectiveLargestDimension: number }) => {
    const now = performance.now();
    if (now - lastLoggedRef.current < 250) return;
    lastLoggedRef.current = now;
    console.log('BLADE_SIZE_CALIBRATION', JSON.stringify(snapshot));
  };
  return (
    <main className="flex min-h-screen flex-col bg-[#090b09] p-4 text-stone-100 sm:p-7">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">Spin Blade preview</div>
          <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-4xl">Production visual check</h1>
        </div>
        <a href="/" className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-stone-300 transition hover:bg-white/5 hover:text-white">Back to app</a>
      </header>
      <section className="relative min-h-[70vh] flex-1 overflow-hidden rounded-[1.75rem] border border-white/10 bg-black shadow-[0_30px_100px_rgba(0,0,0,.45)]">
        <div className="absolute inset-0">
          <BladeVisual progress={.4} running={true} scaleMultiplier={scale} onCalibration={handleCalibration} />
        </div>
        <div className="pointer-events-auto absolute inset-x-0 bottom-4 mx-auto w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-white/15 bg-black/65 px-4 py-3 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
            <span className="text-stone-300">Model size</span>
            <span className="font-mono text-lime-300">x{scale.toFixed(2)}</span>
          </div>
          <input type="range" min={0.4} max={2} step={0.05} value={scale} onChange={(event) => setScale(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-lime-300" aria-label="Model size" />
          <div className="mt-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-stone-500">
            <span>Smaller</span>
            <span>Larger</span>
          </div>
          <div className="mt-2 text-[10px] text-stone-500">Drag the slider and read <code className="font-mono text-lime-300">BLADE_SIZE_CALIBRATION</code> in the console.</div>
        </div>
      </section>
    </main>
  );
}
