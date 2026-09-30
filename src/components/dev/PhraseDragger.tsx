import { useState, useEffect } from 'react';

export function PhraseDragger() {
  const [pos, setPos] = useState({ x: 0.1, y: 0.5, size: 0.05 }); // size in viewport height
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isDragging) {
        setPos(p => ({
          ...p,
          x: Math.max(0, Math.min(1, e.clientX / window.innerWidth)),
          y: Math.max(0, Math.min(1, e.clientY / window.innerHeight))
        }));
      } else if (isResizing) {
        setPos(p => ({
          ...p,
          size: Math.max(0.01, Math.min(0.2, Math.abs(e.clientY - p.y * window.innerHeight) / window.innerHeight))
        }));
      }
    };
    
    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, isResizing]);

  return (
    <div className="absolute inset-0 z-[99999] pointer-events-none">
      {/* The Draggable Letter */}
      <div 
        className="absolute pointer-events-auto cursor-move flex items-center justify-center font-serif italic text-yellow-300 drop-shadow-[0_0_8px_rgba(255,200,0,0.8)]"
        style={{
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          fontSize: `${pos.size * 100}vh`,
          transform: 'translate(-50%, -50%)',
          userSelect: 'none',
          touchAction: 'none' // Crucial for touch dragging!
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
      >
        A
      </div>

      {/* Resize Handle (below the letter) */}
      <div 
        className="absolute pointer-events-auto cursor-ns-resize bg-white rounded-full border-4 border-yellow-500 shadow-xl"
        style={{
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100 + pos.size * 50 + 2}%`,
          width: '30px',
          height: '30px',
          transform: 'translate(-50%, -50%)',
          touchAction: 'none'
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      />

      {/* Coordinates Display */}
      <div className="absolute top-4 left-4 bg-black/90 text-white font-mono p-4 rounded-lg text-xl pointer-events-auto shadow-2xl border-2 border-yellow-500">
        <div className="text-yellow-400 font-bold mb-2">Letter 'A' position:</div>
        <div>X: {pos.x.toFixed(4)}</div>
        <div>Y: {pos.y.toFixed(4)}</div>
        <div>Size: {pos.size.toFixed(4)}</div>
        <div className="text-gray-300 text-sm mt-3 leading-relaxed">
          - Drag the letter "A" to set the start position.<br/>
          - Drag the white circle below it to change size.<br/>
          - Copy these 3 values and send them to me!
        </div>
      </div>
    </div>
  );
}

