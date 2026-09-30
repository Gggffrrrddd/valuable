import { useState, useRef, useEffect } from 'react';
import { PHRASE } from '../focus-visuals/garden/config';

export function PhraseDragger() {
  const [box, setBox] = useState({ 
    x: PHRASE.boxX, 
    y: PHRASE.boxY, 
    w: PHRASE.boxW, 
    h: PHRASE.boxH 
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dragging state
  const dragStart = useRef<{x: number, y: number, boxX: number, boxY: number} | null>(null);
  const resizeStart = useRef<{x: number, y: number, boxW: number, boxH: number} | null>(null);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      if (dragStart.current) {
        const dx = (e.clientX - dragStart.current.x) / rect.width;
        const dy = (e.clientY - dragStart.current.y) / rect.height;
        setBox(b => ({
          ...b,
          x: Math.max(0, Math.min(1 - b.w, dragStart.current!.boxX + dx)),
          y: Math.max(0, Math.min(1 - b.h, dragStart.current!.boxY + dy))
        }));
      } else if (resizeStart.current) {
        const dx = (e.clientX - resizeStart.current.x) / rect.width;
        const dy = (e.clientY - resizeStart.current.y) / rect.height;
        setBox(b => ({
          ...b,
          w: Math.max(0.1, Math.min(1 - b.x, resizeStart.current!.boxW + dx)),
          h: Math.max(0.05, Math.min(1 - b.y, resizeStart.current!.boxH + dy))
        }));
      }
    };
    
    const handleUp = () => {
      dragStart.current = null;
      resizeStart.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-[9999] pointer-events-none"
    >
      {/* The Draggable Box */}
      <div 
        className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/20 pointer-events-auto flex items-center justify-center cursor-move"
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragStart.current = { x: e.clientX, y: e.clientY, boxX: box.x, boxY: box.y };
        }}
      >
        <span className="text-yellow-200 font-serif italic text-2xl px-4 text-center pointer-events-none drop-shadow-md">
          Sample Phrase Text Looks Like This
        </span>
        
        {/* Resize Handle */}
        <div 
          className="absolute bottom-0 right-0 w-8 h-8 bg-yellow-500 cursor-se-resize translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white"
          onPointerDown={(e) => {
            e.stopPropagation();
            resizeStart.current = { x: e.clientX, y: e.clientY, boxW: box.w, boxH: box.h };
          }}
        />
      </div>

      {/* Coordinates Display */}
      <div className="absolute top-4 left-4 bg-black/80 text-white font-mono p-4 rounded-lg text-lg pointer-events-auto shadow-xl border border-yellow-500/30">
        <div className="text-yellow-400 font-bold mb-2">Phrase Coordinates:</div>
        <div>boxX: {box.x.toFixed(4)}</div>
        <div>boxY: {box.y.toFixed(4)}</div>
        <div>boxW: {box.w.toFixed(4)}</div>
        <div>boxH: {box.h.toFixed(4)}</div>
        <div className="text-gray-400 text-sm mt-2">
          Drag the box to move.<br/>
          Drag the circle to resize.<br/>
          Copy these 4 values!
        </div>
      </div>
    </div>
  );
}
