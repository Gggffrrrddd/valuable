import { useState } from 'react';

export function PhraseDragger() {
  const [pos, setPos] = useState({ x: 0.1, y: 0.5, size: 0.05 }); // size in viewport height

  return (
    <div className="absolute inset-0 z-[99999] pointer-events-none">
      {/* The Tuned Letter Preview */}
      <div 
        className="absolute flex items-center justify-center font-serif italic text-yellow-300 drop-shadow-[0_0_8px_rgba(255,200,0,0.8)]"
        style={{
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          fontSize: `${pos.size * 100}vh`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        A
      </div>

      {/* Tuner UI Panel */}
      <div className="absolute top-4 left-4 bg-black/90 text-white font-mono p-6 rounded-lg text-lg pointer-events-auto shadow-2xl border-2 border-yellow-500 w-80">
        <div className="text-yellow-400 font-bold mb-4 text-xl">Phrase Tuner</div>
        
        <div className="mb-4">
          <label className="flex justify-between mb-1">
            <span>X Position</span>
            <span className="text-yellow-300">{pos.x.toFixed(3)}</span>
          </label>
          <input 
            type="range" min="0" max="1" step="0.001" 
            value={pos.x} onChange={e => setPos(p => ({ ...p, x: parseFloat(e.target.value) }))}
            className="w-full cursor-pointer"
          />
        </div>

        <div className="mb-4">
          <label className="flex justify-between mb-1">
            <span>Y Position</span>
            <span className="text-yellow-300">{pos.y.toFixed(3)}</span>
          </label>
          <input 
            type="range" min="0" max="1" step="0.001" 
            value={pos.y} onChange={e => setPos(p => ({ ...p, y: parseFloat(e.target.value) }))}
            className="w-full cursor-pointer"
          />
        </div>

        <div className="mb-6">
          <label className="flex justify-between mb-1">
            <span>Font Size</span>
            <span className="text-yellow-300">{pos.size.toFixed(3)}</span>
          </label>
          <input 
            type="range" min="0.01" max="0.2" step="0.001" 
            value={pos.size} onChange={e => setPos(p => ({ ...p, size: parseFloat(e.target.value) }))}
            className="w-full cursor-pointer"
          />
        </div>

        <button 
          onClick={() => {
            console.log(`[Phrase Tuner] X: ${pos.x.toFixed(4)}, Y: ${pos.y.toFixed(4)}, Size: ${pos.size.toFixed(4)}`);
            alert("Values printed to browser console!");
          }}
          className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded transition-colors"
        >
          Save to Console
        </button>
      </div>
    </div>
  );
}

