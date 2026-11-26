import DOMPurify from "dompurify";

export const MAX_CARD_WIDTH = 480;
export const DEFAULT_SVG_SIZE = { width: 480, height: 360 };

// Une référence externe (http:, //, chemin relatif…) ferait charger une ressource hors du board.
DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName !== "href" && data.attrName !== "xlink:href") return;
  const value = data.attrValue.trim();
  if (!value.startsWith("#") && !value.startsWith("data:")) data.keepAttr = false;
});

export function sanitizeSvg(text: string): string {
  return DOMPurify.sanitize(text, { USE_PROFILES: { svg: true, svgFilters: true } });
}
