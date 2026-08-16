/*
 * Geometry contract for the study-circle table.
 *
 * All coordinates are in pixels of the FULL-RESOLUTION table-scene.png, and the
 * scene is rendered cover-fit (cropped, never letterboxed), so overlays stay
 * pixel-aligned with the baked-in chairs/books at every viewport size.
 *
 * PLACEHOLDER VALUES: scene dimensions and anchors below match the generated
 * placeholder assets (scripts/generate-table-placeholders.mjs). When the real
 * table-scene.png + measured coordinates arrive, update only this file:
 *   - SCENE.width / SCENE.height to the real image size,
 *   - SEATS[i].figure / SEATS[i].book to the measured centers.
 * Overlay sizes (FIGURE_OVERLAY / BOOK_OVERLAY) are likewise in scene pixels.
 */

export const SCENE = {
  url: '/visuals/table/table-scene.png',
  width: 1920,
  height: 1080,
} as const;

export const FIGURE_URL = '/visuals/table/student-figure.png';

/** Frame 0 is the closed book; frames 1-4 open progressively (4 = fully open). */
export const BOOK_FRAME_URLS = [
  '/visuals/table/book-closed.png',
  '/visuals/table/book-open-1.png',
  '/visuals/table/book-open-2.png',
  '/visuals/table/book-open-3.png',
  '/visuals/table/book-open-4.png',
] as const;

export const BOOK_OPEN_FRAME = BOOK_FRAME_URLS.length - 1;

export interface Point {
  x: number;
  y: number;
}

export interface SeatAnchors {
  /** Center of the student-figure overlay for this seat. */
  figure: Point;
  /** Center of the book-state overlay for this seat. */
  book: Point;
}

/** Seat 1 (index 0) is ALWAYS the current user; seats 2-6 map to friends. */
export const SEATS: SeatAnchors[] = [
  { figure: { x: 960, y: 905 }, book: { x: 960, y: 742 } },  // seat 1 — front-center (current user)
  { figure: { x: 475, y: 530 }, book: { x: 640, y: 573 } },  // seat 2 — top-left
  { figure: { x: 1445, y: 530 }, book: { x: 1280, y: 573 } }, // seat 3 — top-right
  { figure: { x: 330, y: 700 }, book: { x: 585, y: 668 } },  // seat 4 — left
  { figure: { x: 1590, y: 700 }, book: { x: 1335, y: 668 } }, // seat 5 — right
  { figure: { x: 960, y: 385 }, book: { x: 960, y: 515 } },  // seat 6 — top-center
];

export const FIGURE_OVERLAY = { width: 170, height: 238 } as const;
export const BOOK_OVERLAY = { width: 110, height: 75 } as const;

/** Screen-reader phrasing per presence status. */
export const SEAT_STATUS_TEXT = {
  offline: 'away',
  'online-idle': 'online',
  focusing: 'focusing',
  paused: 'paused',
} as const;
