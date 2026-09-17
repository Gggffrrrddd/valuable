/*
 * Geometry contract for the 3D study-circle table.
 *
 * The loaded model's thin axis is Y: the tabletop lies flat in the XZ plane
 * with no extra rotation, normalized to 3.2 units across (X/Z span 3.2, Y span
 * ~1.515, centered on the origin, so the top surface is at y ~= 0.757).
 *
 * `SEAT_POSITIONS_3D` are the seat anchors in world units, laid out around the
 * table the same way the 2D scene used them (seat 1 = self, front-center;
 * seats 2-6 = friends, clockwise). y = 0 sits the figure's feet on the floor.
 * They are placeholders in the table's normalized coordinate space and can be
 * fine-tuned once the model is viewed in the browser.
 */

export interface SeatPosition3D {
  /** Where the student figure sprite is anchored (feet on the floor). */
  position: [number, number, number];
  /** Billboard size in world units (width, height). */
  size: [number, number];
}

const FIGURE_W = 0.62;
const FIGURE_H = 0.87;

export const SEAT_POSITIONS_3D: SeatPosition3D[] = [
  { position: [0, 0, 1.62], size: [FIGURE_W, FIGURE_H] },        // seat 1 — self, front-center
  { position: [-1.62, 0, -0.32], size: [FIGURE_W, FIGURE_H] },   // seat 2 — left
  { position: [1.62, 0, -0.32], size: [FIGURE_W, FIGURE_H] },    // seat 3 — right
  { position: [-1.62, 0, 0.86], size: [FIGURE_W, FIGURE_H] },    // seat 4 — front-left
  { position: [1.62, 0, 0.86], size: [FIGURE_W, FIGURE_H] },     // seat 5 — front-right
  { position: [0, 0, -1.62], size: [FIGURE_W, FIGURE_H] },       // seat 6 — back-center
];

export const BOOK_OFFSET: [number, number, number] = [0, 0.04, 0.34];
export const BOOK_SIZE: [number, number] = [0.42, 0.28];
