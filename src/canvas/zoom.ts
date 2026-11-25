export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const RESET_ZOOM = 1;
export const FIT_PADDING_PX = 80;

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)} %`;
}
