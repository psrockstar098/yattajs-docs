"use client";

// components/docs/code-block.tsx
//
// Professional documentation code block: rounded, labelled, copyable, with
// line numbers. Syntax highlighting is a small fixed rule set rather than a
// highlighter dependency — the palette here is fixed, so a full parser would
// cost more than it returns.

import { useState } from "react";

const KEYWORDS =
  /\b(import|from|export|const|let|var|function|return|await|async|new|class|extends|if|else|for|of|in|try|catch|throw|type|interface|default|as|declare|module|null|undefined|true|false)\b/;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlight(line: string): string {
  let out = "";
  let i = 0;

  while (i < line.length) {
    const rest = line.slice(i);

    // Line comment.
    const lineComment = rest.match(/^(\/\/|#)(.*)$/);
    if (lineComment) {
      out += `<span class="text-[#f3eed7]/30">${escapeHtml(lineComment[0])}</span>`;
      break;
    }

    // Block comment.
    if (rest.startsWith("/*")) {
      const end = line.indexOf("*/", i);
      const stop = end === -1 ? line.length : end + 2;
      out += `<span class="text-[#f3eed7]/30">${escapeHtml(line.slice(i, stop))}</span>`;
      i = stop;
      continue;
    }

    // Quoted string.
    const str = rest.match(/^(['"`])(?:\\.|(?!\1)[^\\])*\1?/);
    if (str) {
      out += `<span class="text-[#c3d68a]">${escapeHtml(str[0])}</span>`;
      i += str[0].length;
      continue;
    }

    // Number.
    const num = rest.match(/^\d+(\.\d+)?/);
    if (num) {
      out += `<span class="text-[#d9a441]">${escapeHtml(num[0])}</span>`;
      i += num[0].length;
      continue;
    }

    // Identifier.
    const word = rest.match(/^[A-Za-z_$][\w$]*/);
    if (word) {
      const isKeyword = KEYWORDS.test(word[0]);
      const isCall = /^\s*\(/.test(rest.slice(word[0].length));
      const color = isKeyword
        ? "text-[#d98a7a]"
        : isCall
          ? "text-[#8ab4a8]"
          : "text-[#f3eed7]/70";
      out += `<span class="${color}">${escapeHtml(word[0])}</span>`;
      i += word[0].length;
      continue;
    }

    // Punctuation and operators.
    const ch = line[i]!;
    if (/[{}[\]().,;:=<>+\-*/%!&|?]/.test(ch)) {
      out += `<span class="text-[#f3eed7]/40">${escapeHtml(ch)}</span>`;
    } else {
      out += escapeHtml(ch);
    }
    i += 1;
  }

  return out;
}

export function CodeBlock({
  code,
  title,
  lang = "ts",
}: {
  code: string;
  title?: string;
  lang?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is unavailable over plain http or in restricted contexts.
    }
  };

  const lines = code.replace(/\n+$/, "").split("\n");

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-[#f3eed7]/10 bg-[#0c0c0b]">
      <figcaption className="flex items-center justify-between border-b border-[#f3eed7]/10 px-4 py-2">
        <span className="font-mono text-[11px] text-[#f3eed7]/40">
          {title ?? lang}
        </span>

        <span className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#f3eed7]/25">
            {lang}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy code"
            className="font-mono text-[11px] text-[#f3eed7]/35 transition-colors hover:text-[#f3eed7]/75"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </figcaption>

      <div className="overflow-x-auto">
        <pre className="px-4 py-4 text-[13px] leading-[1.7]">
          <code className="font-mono">
            {lines.map((line, idx) => (
              <span key={idx} className="flex">
                <span
                  aria-hidden
                  className="w-9 shrink-0 select-none pr-4 text-right text-[#f3eed7]/15"
                >
                  {idx + 1}
                </span>
                <span
                  className="min-w-0 whitespace-pre"
                  dangerouslySetInnerHTML={{
                    __html: highlight(line) || "&nbsp;",
                  }}
                />
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}
