import sanitizeHtml from "sanitize-html";

/**
 * Allow-list HTML for user-editable rich text (projects body, descriptions, home copy).
 * Prefer this over regex-only stripping for robust XSS mitigation.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "sub",
    "sup",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
    "hr",
    "span",
    "div",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    span: ["class"],
    div: ["class"],
    p: ["class"],
    code: ["class"],
    pre: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const next = { ...attribs };
      const rel = (next.rel || "").trim();
      if (next.target === "_blank" && !rel.includes("noopener")) {
        next.rel = rel ? `${rel} noopener noreferrer` : "noopener noreferrer";
      }
      return { tagName, attribs: next };
    },
  },
};

/**
 * Sanitize user-editable HTML/markdown-like content for safe display.
 * Strips scripts, iframes, inline handlers, and disallowed tags/URLs.
 */
export function sanitizeTextForDisplay(input: string | null | undefined): string {
  if (input == null || typeof input !== "string") {
    return "";
  }
  return sanitizeHtml(input, SANITIZE_OPTIONS);
}
