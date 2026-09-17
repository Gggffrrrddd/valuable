/*
 * Geometry contract for the 3D study-circle table.
 *
 * `SEAT_POSITIONS_3D` are the seat anchors in the R3F scene's world units,
 * laid out around the table the same way the 2D scene used them
 * (seat 1 = self, front-center; seats 2-6 = friends, clockwise).
 * They are placeholders in the table's normalized coordinate space and can be
 * fine-tuned once the model is viewed in the browser.
 */

export interface SeatPosition3D {
  /** Where the student figure sprite is anchored. */
  position: [number, number, number];
  /** Billboard size in world units (width, height). */
  size: [number, number];
}

const FIGURE_W = 0.62;
const FIGURE_H = 0.87;

export const SEAT_POSITIONS_3D: SeatPosition3D[] = [
  { position: [0, 0.06, 1.62], size: [FIGURE_W, FIGURE_H] },        // seat 1 — self, front-center
  { position: [-1.62, 0.06, -0.32], size: [FIGURE_W, FIGURE_H], },  // seat 2 — left
  { position: [1.62, 0.06, -0.32], size: [FIGURE_W, FIGURE_H] },    // seat 3 — right
  { position: [-1.62, 0.06, 0.86], size: [FIGURE_W, FIGURE_H] },    // seat 4 — front-left
  { position: [1.62, 0.06, 0.86], size: [FIGURE_W, FIGURE_H] },     // seat 5 — front-right
  { position: [0, 0.06, -1.62], size: [FIGURE_W, FIGURE_H] },       // seat 6 — back-center
];

export const BOOK_OFFSET: [number, number, number] = [0, 0.04, 0.34];
export const BOOK_SIZE: [number, number] = [0.42, 0.28];
