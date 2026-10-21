/**
 * What the matchMedia mock answers: the width (tests of phone layouts change it), reduced
 * motion, on by default so overlays close at once the way tests expect (motion tests turn it off),
 * and whether a finger is the pointer (on-screen keyboard tests turn it on).
 */
export const testViewport = { width: 1280, reducedMotion: true, touch: false };

export function setViewportWidth(width: number): void {
  testViewport.width = width;
}

export function setReducedMotion(reduced: boolean): void {
  testViewport.reducedMotion = reduced;
}

export function setTouchScreen(touch: boolean): void {
  testViewport.touch = touch;
}
