import { Check, X } from 'lucide-react';
import type { AvatarCharacter } from '@/types';
import { characterLabel } from '@/lib/character';

const CHARACTER_PHOTOS: Record<AvatarCharacter, string> = {
  boy: '/visuals/table/character-boy.jpg',
  girl: '/visuals/table/character-girl.jpg',
};

/**
 * Character portrait used by the picker and the Circle page. Photos keep the
 * choice instantly readable, unlike an abstract silhouette.
 */
export function CharacterPortrait({
  character,
  className = '',
}: {
  character: AvatarCharacter;
  className?: string;
}) {
  return (
    <img
      src={CHARACTER_PHOTOS[character]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`object-cover ${className}`}
    />
  );
}

export type CharacterPickerMode = 'first' | 'change';

interface CharacterPickerProps {
  mode: CharacterPickerMode;
  value: AvatarCharacter;
  onChange: (character: AvatarCharacter) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  saving?: boolean;
  error?: string | null;
}

export default function CharacterPicker({
  mode,
  value,
  onChange,
  onConfirm,
  onDismiss,
  saving = false,
  error = null,
}: CharacterPickerProps) {
  const firstTime = mode === 'first';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-picker-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-white/[.09] bg-[#0d0f0c] shadow-[0_30px_120px_rgba(0,0,0,.7)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[2rem]"
      >
        <div className="relative px-5 pb-5 pt-6 sm:px-7">
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="icon-button absolute right-3 top-3 h-9 w-9 disabled:opacity-40"
            aria-label={firstTime ? 'Skip character choice' : 'Close character picker'}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="page-kicker">Your table identity</div>
          <h2 id="character-picker-title" className="mt-2 font-display text-2xl font-extrabold tracking-[-.03em] text-stone-50">
            {firstTime ? 'Choose your character' : 'Change your character'}
          </h2>
          <p className="mt-1.5 max-w-sm text-xs leading-5 text-stone-500">
            {firstTime
              ? 'This is how your friends will see you at the study table. You can change it later from the Circle page.'
              : 'Your friends see the character you pick here at the study table.'}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Character">
            {(['boy', 'girl'] as const).map((character) => {
              const selected = value === character;
              return (
                <button
                  key={character}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(character)}
                  disabled={saving}
                  className={`group relative overflow-hidden rounded-2xl border text-left transition disabled:opacity-60 ${
                    selected
                      ? 'border-lime-300/70 bg-lime-300/[.06] shadow-[0_0_45px_rgba(197,255,84,.14)]'
                      : 'border-white/[.08] bg-white/[.025] hover:border-white/20'
                  }`}
                >
                  <div className="relative h-40 w-full overflow-hidden bg-black/40 sm:h-44">
                    <img
                      src={CHARACTER_PHOTOS[character]}
                      alt={`${characterLabel(character)} character`}
                      draggable={false}
                      className={`h-full w-full object-cover transition duration-500 ${
                        selected
                          ? 'scale-[1.02]'
                          : 'brightness-[.72] grayscale-[.35] group-hover:scale-[1.02] group-hover:brightness-100 group-hover:grayscale-0'
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f0c] via-[#0d0f0c]/10 to-transparent" />
                    {selected && (
                      <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-lime-300 text-[#11130f] shadow-lg">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-3.5 pb-3.5 pt-2">
                    <span className={`text-sm font-bold ${selected ? 'text-stone-50' : 'text-stone-300'}`}>
                      {characterLabel(character)}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-[.16em] ${selected ? 'text-lime-300' : 'text-stone-600'}`}>
                      {selected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          <div className="mt-5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onDismiss}
              disabled={saving}
              className="rounded-xl px-3 py-2.5 text-xs font-bold text-stone-500 transition hover:text-stone-200 disabled:opacity-50"
            >
              {firstTime ? 'Skip for now' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="ml-auto rounded-xl bg-lime-300 px-5 py-2.5 text-xs font-extrabold text-[#11130f] transition hover:bg-lime-200 disabled:opacity-60"
            >
              {saving ? 'Saving…' : firstTime ? 'Continue' : 'Save character'}
            </button>
          </div>
          {firstTime && (
            <p className="mt-3 text-[10px] leading-4 text-stone-600">
              Skipping keeps the default Boy character and won&apos;t ask again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
