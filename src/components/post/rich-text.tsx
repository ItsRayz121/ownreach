import Link from "next/link";
import { Fragment } from "react";

// Deliberately not full Markdown/HTML — a small, safe subset (bold, italic,
// links, #hashtags, @mentions) rendered as React nodes so there's never a
// raw-HTML injection surface to sanitize.
const TOKEN_RE =
  /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(https?:\/\/[^\s]+)|(#[a-zA-Z0-9_]{2,50})|(@[a-zA-Z0-9_]{2,30})/g;

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

    const [full, bold, italic, url, hashtag, mention] = match;
    const k = `${lineIndex}-${key++}`;

    if (bold) {
      nodes.push(<strong key={k}>{bold.slice(2, -2)}</strong>);
    } else if (italic) {
      nodes.push(<em key={k}>{italic.slice(1, -1)}</em>);
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
