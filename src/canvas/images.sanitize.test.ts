// @vitest-environment jsdom
import DOMPurify from "dompurify";
import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./images";

describe("sanitizeSvg (DOM réel, FR-010)", () => {
  it("retire <script> et les attributs d'événement", () => {
    const clean = sanitizeSvg('<svg onload="alert(1)"><script>alert(2)</script><rect width="10" height="10"/></svg>');
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onload");
    expect(clean).toContain("<rect");
  });

  it("retire href vers une URL externe", () => {
    const clean = sanitizeSvg('<svg><a href="https://example.com/x.svg"><rect width="10" height="10"/></a></svg>');
    expect(clean).not.toContain("example.com");
    expect(clean).toContain("<rect");
  });

  it("retire xlink:href vers une URL externe", () => {
    const clean = sanitizeSvg('<svg><a xlink:href="https://example.com/x.svg"><rect width="10" height="10"/></a></svg>');
    expect(clean).not.toContain("example.com");
    expect(clean).toContain("<rect");
  });

  it("retire un style qui charge une url(http://...) externe", () => {
    const clean = sanitizeSvg('<svg><rect style="fill:url(http://example.com/p.svg#x)" width="10" height="10"/></svg>');
    expect(clean).not.toContain("example.com");
    expect(clean).toContain("<rect");
  });

  it("refuse de sortir le texte brut quand DOMPurify n'est pas utilisable", () => {
    const original = DOMPurify.isSupported;
    DOMPurify.isSupported = false;
    try {
      expect(() => sanitizeSvg('<svg><script>alert(1)</script></svg>')).toThrow("Assainissement SVG indisponible");
    } finally {
      DOMPurify.isSupported = original;
    }
  });
});
