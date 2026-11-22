import type { AvatarCharacter } from '@/types';

/**
 * Single source of truth for character values.
 *
 * Every read goes through this resolver so the app never renders an unset
 * state: anything missing or invalid falls back to `boy`.
 */
export function resolveAvatarCharacter(value: string | null | undefined): AvatarCharacter {
  return value === 'girl' ? 'girl' : 'boy';
}

export function characterLabel(character: AvatarCharacter): string {
  return character === 'girl' ? 'Girl' : 'Boy';
}
