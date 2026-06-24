"use client";

import { useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>);
    else if (m[3] !== undefined)
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.85em]">
          {m[3]}
        </code>
      );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-background/70">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{lang || "código"}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          }}
          className="text-muted-foreground transition hover:text-primary"
          title="Copiar código"
        >
          {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-xs leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

/** Lightweight markdown renderer: fenced code blocks (with copy), inline code and bold. */
export function ChatMarkdown({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  const fence = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = fence.exec(content)) !== null) {
    if (m.index > last) {
      const t = content.slice(last, m.index).replace(/^\n+|\n+$/g, "");
      if (t) parts.push(<div key={`t${i}`} className="whitespace-pre-wrap">{inline(t, `t${i}`)}</div>);
    }
    parts.push(<CodeBlock key={`c${i}`} lang={m[1]} code={m[2].replace(/\n$/, "")} />);
    last = m.index + m[0].length;
    i++;
  }
  if (last < content.length) {
    const t = content.slice(last).replace(/^\n+|\n+$/g, "");
    if (t) parts.push(<div key="tend" className="whitespace-pre-wrap">{inline(t, "tend")}</div>);
  }
  if (parts.length === 0) return <div className="whitespace-pre-wrap">{inline(content, "only")}</div>;
  return <div className="space-y-1 leading-relaxed">{parts}</div>;
}
