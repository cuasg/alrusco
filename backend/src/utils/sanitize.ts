/**
 * Strip script tags, event handlers, and javascript: URLs from HTML/markdown
 * to reduce XSS risk when content is rendered. Use for user-editable long-form text.
 */
export function sanitizeTextForDisplay(input: string | null | undefined): string {
  if (input == null || typeof input !== "string") return "";
  let s = input;
  // Remove script tags and their content
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  // Remove javascript: and data: URLs (data: can be used for XSS)
  s = s.replace(/\s*(javascript|data):\s*[^\s]*/gi, "");
  // Remove event handler attributes (onclick, onerror, etc.)
  s = s.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");
  return s;
}
