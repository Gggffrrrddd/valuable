import BladeVisual from '@/components/focus-visuals/BladeVisual';

export default function Test3DBlade() {
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
          <BladeVisual progress={.4} running={true} />
        </div>
      </section>
    </main>
  );
}
