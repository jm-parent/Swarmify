// Position des boutons sur le cercle, à partir du haut, sens horaire (repère écran : y vers le bas).
export function radialOffsets(count: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}
