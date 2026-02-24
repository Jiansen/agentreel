"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--accent-cyan)] text-[0.85em] font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block p-3 rounded-lg bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs font-mono overflow-x-auto ${className ?? ""}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <pre className="my-2">{children}</pre>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-blue)] hover:underline"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="min-w-full text-xs border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-[var(--border)] px-2 py-1 bg-[var(--bg-tertiary)] text-left font-medium">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-[var(--border)] px-2 py-1">
                {children}
              </td>
            );
          },
          hr() {
            return <hr className="my-3 border-[var(--border)]" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
