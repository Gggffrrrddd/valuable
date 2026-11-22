import { Check, X } from 'lucide-react';
import type { AvatarCharacter } from '@/types';
import { characterLabel } from '@/lib/character';

/**
 * Code-drawn cartoon avatar. Everything here is inline SVG so the picker has
 * no image dependency, stays crisp at every size, and always matches the
 * character the user picks.
 */
export function CharacterPortrait({
  character,
  className = '',
}: {
  character: AvatarCharacter;
  className?: string;
}) {
  const girl = character === 'girl';
  const id = `avatar-${character}`;

  return (
    <svg
      viewBox="0 0 220 220"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={`${characterLabel(character)} avatar`}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={girl ? '#2b2118' : '#1c2a17'} />
          <stop offset="100%" stopColor="#0b0e0a" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor={girl ? '#e8b48a' : '#c5ff54'} stopOpacity="0.22" />
          <stop offset="100%" stopColor={girl ? '#e8b48a' : '#c5ff54'} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-dots`} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill={girl ? '#f1d5b5' : '#c5ff54'} fillOpacity="0.1" />
        </pattern>
        <linearGradient id={`${id}-shirt`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={girl ? '#c98a5a' : '#465737'} />
          <stop offset="100%" stopColor={girl ? '#9d6541' : '#2f3b26'} />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={girl ? '#3b241c' : '#33221a'} />
          <stop offset="100%" stopColor={girl ? '#24140f' : '#1d120d'} />
        </linearGradient>
        <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={girl ? '#efc09a' : '#e0aa78'} />
          <stop offset="100%" stopColor={girl ? '#d99d72' : '#c98f63'} />
        </linearGradient>
      </defs>

      <rect width="220" height="220" fill={`url(#${id}-bg)`} />
      <rect width="220" height="220" fill={`url(#${id}-dots)`} />
      <circle cx="110" cy="88" r="86" fill={`url(#${id}-halo)`} />

      {/* chair back */}
      <rect x="32" y="138" width="156" height="92" rx="34" fill="#211b16" />
      <rect x="42" y="148" width="136" height="78" rx="28" fill="#332b23" />
      <rect x="52" y="158" width="116" height="52" rx="22" fill="#3b3229" />

      {/* girl hair mass behind the shoulders */}
      {girl && (
        <path
          d="M60 98c-4-38 18-58 50-58s54 20 50 58l-7 58c-3 14-12 22-23 22l-4-56c-10 5-26 5-36 0l-4 56c-11 0-20-8-23-22l-7-58Z"
          fill={`url(#${id}-hair)`}
        />
      )}

      {/* body */}
      <path d="M34 220c0-36 32-62 76-62s76 26 76 62H34Z" fill={`url(#${id}-shirt)`} />
      {girl ? (
        <>
          <path d="M84 162c6 12 14 19 26 19s20-7 26-19" fill="#f0dfc2" />
          <path d="M84 162c6 12 14 19 26 19s20-7 26-19" fill="none" stroke="#8a5a3b" strokeWidth="2" opacity="0.35" />
        </>
      ) : (
        <>
          <path d="M82 160c5 13 14 21 28 21s23-8 28-21" fill="#33402a" />
          <path d="M96 174v22M124 174v22" stroke="#c5ff54" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="96" cy="197" r="2.4" fill="#c5ff54" />
          <circle cx="124" cy="197" r="2.4" fill="#c5ff54" />
        </>
      )}

      {/* neck */}
      <path d="M94 136h32v30c0 10-7 17-16 17s-16-7-16-17v-30Z" fill={girl ? '#d99d72' : '#c98f63'} />

      {/* ears + jewellery */}
      <ellipse cx="66" cy="100" rx="7" ry="11" fill={girl ? '#e8b48a' : '#d9a06b'} />
      <ellipse cx="154" cy="100" rx="7" ry="11" fill={girl ? '#e8b48a' : '#d9a06b'} />
      {girl && (
        <>
          <circle cx="65" cy="112" r="3.2" fill="#e8c27c" />
          <circle cx="155" cy="112" r="3.2" fill="#e8c27c" />
        </>
      )}

      {/* head */}
      <rect x="64" y="50" width="92" height="102" rx="44" fill={`url(#${id}-skin)`} />

      {/* hair */}
      {girl ? (
        <>
          <path
            d="M62 98c-2-35 17-55 48-55s50 20 48 55c-9-8-15-20-17-32-15 10-38 12-53 5-4 11-11 21-19 27Z"
            fill={`url(#${id}-hair)`}
          />
          <path d="M63 92c-5 22-5 43 0 65l11-6c-4-19-4-37-1-53l-10-6Z" fill={`url(#${id}-hair)`} />
          <path d="M157 92c5 22 5 43 0 65l-11-6c4-19 4-37 1-53l10-6Z" fill={`url(#${id}-hair)`} />
        </>
      ) : (
        <>
          <path
            d="M62 95c-2-33 16-53 48-53s50 20 48 53c-8-7-13-18-15-30-14 10-37 13-55 6-3 10-10 19-18 24Z"
            fill={`url(#${id}-hair)`}
          />
          <path d="M67 70c9-18 24-27 43-27 14 0 26 5 35 16-15-7-32-7-47-1-11 4-21 11-31 12Z" fill="#4a2e22" opacity="0.7" />
        </>
      )}

      {/* brows */}
      <path
        d={girl ? 'M79 85c6-4 14-4 20-1' : 'M78 86c6-4 14-4 21-1'}
        fill="none"
        stroke="#3a241b"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d={girl ? 'M121 84c6-3 14-3 20 1' : 'M121 85c7-3 15-3 21 1'}
        fill="none"
        stroke="#3a241b"
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      {/* eyes */}
      <ellipse cx="89" cy="98" rx={girl ? 5.4 : 4.8} ry={girl ? 6.2 : 5.6} fill="#1d1712" />
      <ellipse cx="131" cy="98" rx={girl ? 5.4 : 4.8} ry={girl ? 6.2 : 5.6} fill="#1d1712" />
      <circle cx="90.8" cy="96" r="1.7" fill="#fff" fillOpacity="0.95" />
      <circle cx="132.8" cy="96" r="1.7" fill="#fff" fillOpacity="0.95" />
      {girl && <path d="M83 93l-4-3M137 93l4-3" stroke="#3a241b" strokeWidth="2.4" strokeLinecap="round" />}

      {/* nose + smile */}
      <path
        d="M110 100c-2 6-3 10 1 12 2 1 4 0 6-1"
        fill="none"
        stroke={girl ? '#c1815c' : '#b97a50'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M96 120c4 6 9 9 14 9s10-3 14-9"
        fill="none"
        stroke={girl ? '#a35d55' : '#7c4a32'}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {girl && <path d="M104 128c4 2 8 2 12 0" fill="none" stroke="#c97a70" strokeWidth="2" strokeLinecap="round" opacity="0.6" />}

      {/* blush */}
      <ellipse cx="78" cy="112" rx="7" ry="4" fill={girl ? '#e98b8b' : '#e07a5f'} opacity="0.3" />
      <ellipse cx="142" cy="112" rx="7" ry="4" fill={girl ? '#e98b8b' : '#e07a5f'} opacity="0.3" />

      {/* code-made accents */}
      <circle cx="188" cy="40" r="2" fill={girl ? '#f1d5b5' : '#c5ff54'} opacity="0.5" />
      <circle cx="32" cy="58" r="1.6" fill={girl ? '#f1d5b5' : '#c5ff54'} opacity="0.35" />
      <path
        d="M178 26h12M184 20v12"
        stroke={girl ? '#f1d5b5' : '#c5ff54'}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
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
                    <CharacterPortrait
                      character={character}
                      className={`h-full w-full transition duration-500 ${
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
