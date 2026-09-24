// "Magic pencil": when someone pastes text copied from another platform, the
// formatting is usually carried either as Unicode "fancy text" characters
// (common on Twitter/LinkedIn/Instagram bold/italic generators) or as real
// HTML on the clipboard (copying from a rich-text editor). The browser's
// default paste already inserts plain, safe text — these helpers detect
// whether that plain text lost real formatting and, if so, produce this
// app's own markup so the composer can offer to restore it. Client-side
// only (DOMParser).

type StyleKind = "bold" | "italic" | "monospace" | "plain";

interface UnicodeRange {
  start: number;
  end: number;
  base: number;
  style: Exclude<StyleKind, "plain">;
}

// Mathematical Alphanumeric Symbols block (U+1D400–U+1D7FF) — the ranges
// "fancy text" generators actually use.
const RANGES: UnicodeRange[] = [
  { start: 0x1d400, end: 0x1d419, base: 0x41, style: "bold" },
  { start: 0x1d41a, end: 0x1d433, base: 0x61, style: "bold" },
  { start: 0x1d7ce, end: 0x1d7d7, base: 0x30, style: "bold" },
  { start: 0x1d434, end: 0x1d44d, base: 0x41, style: "italic" },
  { start: 0x1d44e, end: 0x1d467, base: 0x61, style: "italic" },
  { start: 0x1d670, end: 0x1d689, base: 0x41, style: "monospace" },
  { start: 0x1d68a, end: 0x1d6a3, base: 0x61, style: "monospace" },
  { start: 0x1d7f6, end: 0x1d7ff, base: 0x30, style: "monospace" },
];

// A few math-italic letters are reserved code points that reuse existing
// symbols instead of living in the contiguous block above.
const ITALIC_EXCEPTIONS: Record<number, string> = {
  0x210e: "h", // PLANCK CONSTANT stands in for italic "h"
};

function classify(codePoint: number): { style: StyleKind; ascii: string } {
  const exception = ITALIC_EXCEPTIONS[codePoint];
  if (exception) return { style: "italic", ascii: exception };

  for (const range of RANGES) {
    if (codePoint >= range.start && codePoint <= range.end) {
      return { style: range.style, ascii: String.fromCodePoint(range.base + (codePoint - range.start)) };
    }
  }
  return { style: "plain", ascii: String.fromCodePoint(codePoint) };
}

const MARKUP_BY_STYLE: Record<Exclude<StyleKind, "plain">, [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  monospace: ["`", "`"],
};

/** Escapes characters that would otherwise be misread as this app's formatting syntax. */
export function escapeMarkupChars(text: string): string {
  return text.replace(/[*_~`[\]]/g, (ch) => `\\${ch}`);
}

export interface UnicodeConversionResult {
  hasStyledRuns: boolean;
  markup: string;
}

/** Converts Unicode "fancy text" bold/italic/monospace runs into this app's own markup. */
export function unicodeStyledToMarkup(text: string): UnicodeConversionResult {
  const chars = Array.from(text); // code-point aware — these are astral-plane characters
  let hasStyledRuns = false;
  let markup = "";
  let i = 0;

  while (i < chars.length) {
    const first = classify(chars[i].codePointAt(0)!);
    let run = first.ascii;
    let j = i + 1;
    while (j < chars.length) {
      const next = classify(chars[j].codePointAt(0)!);
      if (next.style !== first.style) break;
      run += next.ascii;
      j += 1;
    }

    if (first.style === "plain") {
      markup += escapeMarkupChars(run);
    } else {
      hasStyledRuns = true;
      const [before, after] = MARKUP_BY_STYLE[first.style];
      markup += before + run + after;
    }
    i = j;
  }

  return { hasStyledRuns, markup };
}

const TAG_MARKUP: Record<string, [string, string]> = {
  b: ["**", "**"],
  strong: ["**", "**"],
  i: ["*", "*"],
  em: ["*", "*"],
  u: ["__", "__"],
  s: ["~~", "~~"],
  strike: ["~~", "~~"],
  del: ["~~", "~~"],
  code: ["`", "`"],
  pre: ["`", "`"],
};

export interface HtmlConversionResult {
  hasFormatting: boolean;
  markup: string;
}

/** Converts a pasted HTML clipboard fragment into this app's plain-text pseudo-markdown. */
export function htmlToMarkup(html: string): HtmlConversionResult {
  let hasFormatting = false;

  function walk(node: ChildNode): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeMarkupChars(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join("");

    if (tag === "br") return "\n";
    if (tag === "p" || tag === "div") return `${inner}\n`;

    if (tag === "a") {
      const href = el.getAttribute("href");
      if (href && /^https?:\/\//.test(href) && inner.trim()) {
        hasFormatting = true;
        return `[${inner}](${href})`;
      }
      return inner;
    }

    const wrap = TAG_MARKUP[tag];
    if (wrap && inner.trim()) {
      hasFormatting = true;
      const [before, after] = wrap;
      return before + inner + after;
    }

    return inner;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const markup = Array.from(doc.body.childNodes)
    .map(walk)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { hasFormatting, markup };
}
