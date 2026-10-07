/**
 * What the matchMedia mock answers: the width (tests of phone layouts change it) and reduced
 * motion, on by default so overlays close at once the way tests expect; motion tests turn it off.
 */
export const testViewport = { width: 1280, reducedMotion: true };

export function setViewportWidth(width: number): void {
  testViewport.width = width;
}

export function setReducedMotion(reduced: boolean): void {
  testViewport.reducedMotion = reduced;
}
