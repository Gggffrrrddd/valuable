import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';

export interface LeafOption {
  id: string;
  name: string;
  url: string;
}

export const LEAF_OPTIONS: LeafOption[] = [
  { id: 'leaf-01', name: 'Original', url: '/visuals/tree/leaf-01.png' },
  { id: 'leaf-02', name: 'Maple', url: '/visuals/tree/leaf-02.png' },
];

export const LEAF_STORAGE_KEY = 'valuable-tree-leaf';

interface LeafPickerProps {
  selectedAsset: string;
  onSelect: (asset: string) => void;
  onClose: () => void;
}

export default function LeafPicker({ selectedAsset, onSelect, onClose }: LeafPickerProps) {
  const [preview, setPreview] = useState<string>(selectedAsset);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="leaf-picker-backdrop" onClick={onClose} role="presentation">
      <div className="leaf-picker" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Choose a leaf">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">Tree customization</div>
            <h3 className="mt-1 font-display text-xl font-extrabold text-stone-100">Choose a leaf</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close leaf picker" className="rounded-full border border-white/10 p-2 text-stone-300 transition hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
          {LEAF_OPTIONS.map((option) => {
            const active = preview === option.url;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreview(option.url)}
                onDoubleClick={() => onSelect(option.url)}
                className={`group relative overflow-hidden rounded-2xl border ${active ? 'border-lime-300/80 bg-lime-300/10' : 'border-white/10 bg-black/40'} p-4 text-left transition hover:border-white/25`}
              >
                <div className="flex h-32 items-center justify-center bg-black/20 rounded-xl">
                  <img src={option.url} alt={option.name} className="max-h-28 w-auto" draggable={false} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-100">{option.name}</span>
                  {active && <Check className="h-4 w-4 text-lime-300" />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
          <span className="text-[11px] text-stone-500">Tap to preview, double-tap to apply.</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-stone-300 transition hover:bg-white/10">Cancel</button>
            <button type="button" onClick={() => onSelect(preview)} className="rounded-lg border border-lime-300/40 bg-lime-300/10 px-4 py-2 text-xs font-bold text-lime-300 transition hover:bg-lime-300/20">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
