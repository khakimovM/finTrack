/** Width the matchMedia mock answers for; tests of phone layouts set it and reset it after. */
export const testViewport = { width: 1280 };

export function setViewportWidth(width: number): void {
  testViewport.width = width;
}
