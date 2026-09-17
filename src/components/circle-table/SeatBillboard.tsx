import { useEffect, useRef, useState } from 'react';
import { DoubleSide, Group, SRGBColorSpace, Sprite, Texture } from 'three';
import { loadTexture, useReducedMotion } from '@/components/focus-visuals/model-core';
import { BOOK_FRAME_URLS, BOOK_OPEN_FRAME, FIGURE_URL } from './tableConfig';
import { BOOK_OFFSET, BOOK_SIZE, type SeatPosition3D } from './tableConfig3D';
import type { SeatOccupant } from './TableScene';

const BOOK_STEP_MS = 112;

const TEXTURE_URLS = [FIGURE_URL, ...BOOK_FRAME_URLS];

/**
 * One seat rendered as camera-facing sprites (figure + book) hovering above the
 * 3D table. Reuses the 2D scene's PNG art so the asset set stays single-source.
 */
export default function SeatBillboard({
  seat,
  occupant,
  seatIndex,
}: {
  seat: SeatPosition3D;
  occupant: SeatOccupant;
  seatIndex: number;
}) {
  const groupRef = useRef<Group>(null);
  const present = occupant.status !== 'offline';
  const focusing = occupant.status === 'focusing';

  const textures = useSeatTextures();
  const figureTexture = textures[0];
  const bookTextures = textures.slice(1);
  const ready = textures.length === TEXTURE_URLS.length;

  const reduced = useReducedMotion();

  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const target = focusing ? BOOK_OPEN_FRAME : 0;
    if (reduced) {
      setFrame(target);
      frameRef.current = target;
      return;
    }
    if (frameRef.current === target) return;
    let current = frameRef.current;
    const timer = setInterval(() => {
      current += target > current ? 1 : -1;
      frameRef.current = current;
      setFrame(current);
      if (current === target) clearInterval(timer);
    }, BOOK_STEP_MS);
    return () => clearInterval(timer);
  }, [focusing, reduced]);

  if (!ready) return null;

  return (
    <group ref={groupRef} position={seat.position} name={`seat-${seatIndex}-${occupant.id}`}>
      <BillboardSprite texture={figureTexture} size={seat.size} opacity={present ? 1 : 0} />
      <group position={BOOK_OFFSET}>
        {bookTextures.map((texture, i) => (
          <BillboardSprite
            key={BOOK_FRAME_URLS[i]}
            texture={texture}
            size={BOOK_SIZE}
            opacity={i === frame && focusing ? 1 : i === 0 && !focusing && present ? 1 : 0}
          />
        ))}
      </group>
    </group>
  );
}

function BillboardSprite({
  texture,
  size,
  opacity,
}: {
  texture: Texture;
  size: [number, number];
  opacity: number;
}) {
  const spriteRef = useRef<Sprite>(null);
  return (
    <sprite ref={spriteRef} scale={[size[0], size[1], 1]}>
      <spriteMaterial
        map={texture}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={DoubleSide}
      />
    </sprite>
  );
}

/**
 * Loads the shared figure + book textures once per URL, memoized so every seat
 * in the scene reuses the same decoded images.
 */
function useSeatTextures(): Texture[] {
  const [loaded, setLoaded] = useState<Map<string, Texture>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    TEXTURE_URLS.forEach((url) => {
      if (loaded.has(url)) return;
      loadTexture(url).then((texture) => {
        if (cancelled) return;
        texture.colorSpace = SRGBColorSpace;
        setLoaded((current) => new Map(current).set(url, texture));
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return TEXTURE_URLS.map((url) => loaded.get(url)).filter((t): t is Texture => t !== undefined);
}
