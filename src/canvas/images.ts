import DOMPurify from "dompurify";

export const MAX_CARD_WIDTH = 480;
export const DEFAULT_SVG_SIZE = { width: 480, height: 360 };

// Plafonne la largeur à MAX_CARD_WIDTH en gardant les proportions. Un SVG sans dimensions (0 × 0) prend la taille par défaut.
export function fitImageSize(natural: { width: number; height: number }): { width: number; height: number } {
  if (natural.width <= 0 || natural.height <= 0) return { ...DEFAULT_SVG_SIZE };
  if (natural.width <= MAX_CARD_WIDTH) return { width: natural.width, height: natural.height };
  return {
    width: MAX_CARD_WIDTH,
    height: Math.max(1, Math.round((natural.height * MAX_CARD_WIDTH) / natural.width)),
  };
}

// Une cible hors du board (http:, //, chemin relatif…) ferait charger une ressource externe.
function isLocalTarget(target: string): boolean {
  const value = target.trim().toLowerCase();
  return value.startsWith("#") || value.startsWith("data:");
}

export function sanitizeSvg(text: string): string {
  // Déclarée ici et retirée à la fin de l'appel : les autres usages de DOMPurify ne sont pas affectés.
  function dropExternalReferences(_node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) {
    const value = data.attrValue.trim();
    if (data.attrName === "href" || data.attrName === "xlink:href") {
      if (!isLocalTarget(value)) data.keepAttr = false;
      return;
    }
    for (const match of value.matchAll(/url\(\s*(['"]?)([^'")]*)/gi)) {
      if (!isLocalTarget(match[2])) {
        data.keepAttr = false;
        return;
      }
    }
  }

  DOMPurify.addHook("uponSanitizeAttribute", dropExternalReferences);
  try {
    return DOMPurify.sanitize(text, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ["style"],
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute", dropExternalReferences);
  }
}
