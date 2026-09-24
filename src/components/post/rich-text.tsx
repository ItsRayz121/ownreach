import Link from "next/link";
import { Fragment } from "react";

// Deliberately not full Markdown/HTML — a small, safe subset (bold, italic,
// underline, strikethrough, inline code, links, #hashtags, @mentions)
// rendered as React nodes so there's never a raw-HTML injection surface to
// sanitize. `\X` escapes a literal `* _ ~ \` [ ]` so pasted/typed text that
// happens to contain those characters doesn't get misread as formatting.
//
// Note: `__word__` styles as underline even mid-identifier (e.g. `__init__`)
// — a known tradeoff of underscore-delimited syntax, same as real Markdown.
const TOKEN_RE =
  /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\n]+\))|(\\[*_~`[\]])|(https?:\/\/[^\s]+)|(#[a-zA-Z0-9_]{2,50})|(@[a-zA-Z0-9_]{2,30})/g;

const LINK_RE = /^\[([^\]\n]+)\]\(([^)\n]+)\)$/;

export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {renderLine(line, lineIndex)}
        </Fragment>
      ))}
    </>
  );
}

function renderLine(line: string, lineIndex: number) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(line))) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const [full, bold, italic, underline, strike, code, link, escaped, url, hashtag, mention] = match;
    const k = `${lineIndex}-${key++}`;

    if (bold) {
      nodes.push(<strong key={k}>{bold.slice(2, -2)}</strong>);
    } else if (italic) {
      nodes.push(<em key={k}>{italic.slice(1, -1)}</em>);
    } else if (underline) {
      nodes.push(<u key={k}>{underline.slice(2, -2)}</u>);
    } else if (strike) {
      nodes.push(<s key={k}>{strike.slice(2, -2)}</s>);
    } else if (code) {
      nodes.push(
        <code key={k} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]">
          {code.slice(1, -1)}
        </code>
      );
    } else if (link) {
      const parsed = LINK_RE.exec(link);
      const [, linkText, linkUrl] = parsed ?? [];
      if (linkUrl && /^https?:\/\//.test(linkUrl)) {
        nodes.push(
          <a key={k} href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {linkText}
          </a>
        );
      } else {
        nodes.push(full);
      }
    } else if (escaped) {
      nodes.push(escaped.slice(1));
    } else if (url) {
      nodes.push(
        <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {url}
        </a>
      );
    } else if (hashtag) {
      nodes.push(
        <Link key={k} href={`/explore?q=${encodeURIComponent(hashtag)}`} className="text-primary hover:underline">
          {hashtag}
        </Link>
      );
    } else if (mention) {
      nodes.push(
        <Link key={k} href={`/${mention.slice(1)}`} className="text-primary hover:underline">
          {mention}
        </Link>
      );
    } else {
      nodes.push(full);
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}
