import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ChevronDown, ChevronUp, Code, Maximize2, Minimize2 } from 'lucide-react';

interface MarkdownMessageProps {
  content?: string;
}

interface CodeBlockProps {
  language?: string;
  code?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language = '', code = '' }) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const safeCode = typeof code === 'string' ? code : String(code || '');
  const lineCount = safeCode.trim() ? safeCode.trim().split('\n').length : 0;
  const isLongCode = lineCount > 10;

  const handleCopy = () => {
    navigator.clipboard.writeText(safeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 bg-slate-950/90 border border-white/15 rounded-xl overflow-hidden shadow-xl text-xs font-mono dir-ltr text-left group">
      {/* Code Header Bar */}
      <div className="px-3 py-2 bg-slate-900/80 border-b border-white/10 flex items-center justify-between text-[11px] text-slate-300 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500/80 inline-block"></span>
          <span className="font-bold text-cyan-300 uppercase tracking-wider">
            {language || 'code'}
          </span>
          <span className="text-[10px] text-slate-500">({lineCount} سطر)</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Collapse/Expand toggle for long code */}
          {isLongCode && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer text-[10px]"
              title={isCollapsed ? 'نمایش کامل کد' : 'بستن بخش کد'}
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="w-3 h-3 text-cyan-400" />
                  <span>نمایش کامل</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3 text-cyan-400" />
                  <span>بستن کد</span>
                </>
              )}
            </button>
          )}

          {/* Copy Code Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-transparent hover:border-cyan-500/30 rounded-lg transition-colors cursor-pointer text-[10px]"
            title="کپی کردن کد"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-bold">کپی شد</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>کپی کد</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div className="relative">
        <pre
          className={`p-3.5 overflow-x-auto text-slate-200 leading-relaxed font-mono ${
            isCollapsed ? 'max-h-32 overflow-hidden' : ''
          }`}
        >
          <code>{safeCode}</code>
        </pre>

        {/* Gradient blur overlay when collapsed */}
        {isCollapsed && (
          <div
            onClick={() => setIsCollapsed(false)}
            className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-end justify-center pb-2 cursor-pointer group-hover:from-slate-950/90"
          >
            <span className="text-[11px] font-sans font-medium text-cyan-400 bg-slate-900/90 px-3 py-1 rounded-full border border-cyan-500/30 shadow-lg flex items-center gap-1">
              <ChevronDown className="w-3 h-3" />
              <span>نمایش باقی کد ({Math.max(0, lineCount - 4)} سطر دیگر)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content = '' }) => {
  const [isSectionCollapsed, setIsSectionCollapsed] = useState(false);
  const safeContent = typeof content === 'string' ? content : (content ? String(content) : '');
  const isVeryLongMessage = safeContent.length > 2500;

  return (
    <div className="markdown-content text-slate-100 text-xs sm:text-sm leading-relaxed dir-auto text-right">
      <div className={`relative ${isSectionCollapsed ? 'max-h-48 overflow-hidden' : ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');

              if (!inline && (match || codeString.includes('\n'))) {
                return <CodeBlock language={match ? match[1] : ''} code={codeString} />;
              }

              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-slate-950/80 text-cyan-300 font-mono text-[0.9em] border border-cyan-500/20 dir-ltr inline-block mx-0.5"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            h1({ children }) {
              return (
                <h1 className="text-base sm:text-lg font-bold text-white border-b border-white/10 pb-1.5 my-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-cyan-400 rounded-full inline-block"></span>
                  {children}
                </h1>
              );
            },
            h2({ children }) {
              return (
                <h2 className="text-sm sm:text-base font-bold text-cyan-200 my-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-cyan-500 rounded-full inline-block"></span>
                  {children}
                </h2>
              );
            },
            h3({ children }) {
              return <h3 className="text-xs sm:text-sm font-semibold text-cyan-300 my-2">{children}</h3>;
            },
            p({ children }) {
              return <p className="my-2 leading-relaxed text-slate-200 dir-auto break-words">{children}</p>;
            },
            ul({ children }) {
              return <ul className="list-disc pr-5 my-2 space-y-1.5 text-slate-200 dir-rtl">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="list-decimal pr-5 my-2 space-y-1.5 text-slate-200 dir-rtl">{children}</ol>;
            },
            li({ children }) {
              return <li className="leading-relaxed">{children}</li>;
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-r-4 border-cyan-500 bg-cyan-950/30 pr-3.5 py-2 my-3 rounded-l-xl text-slate-300 italic border-l-0">
                  {children}
                </blockquote>
              );
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-3 border border-white/10 rounded-xl bg-slate-950/60 shadow-lg dir-rtl">
                  <table className="w-full text-right text-xs divide-y divide-white/10">{children}</table>
                </div>
              );
            },
            thead({ children }) {
              return <thead className="bg-slate-900/80 font-bold text-cyan-300">{children}</thead>;
            },
            th({ children }) {
              return <th className="p-2.5 font-bold border-b border-white/10">{children}</th>;
            },
            td({ children }) {
              return <td className="p-2.5 border-b border-white/5 text-slate-300">{children}</td>;
            },
            a({ href, children }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors font-medium"
                >
                  {children}
                </a>
              );
            },
            hr() {
              return <hr className="my-4 border-white/10" />;
            },
          }}
        >
          {safeContent}
        </ReactMarkdown>

        {/* Collapsed blur gradient for long messages */}
        {isSectionCollapsed && (
          <div
            onClick={() => setIsSectionCollapsed(false)}
            className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex items-end justify-center pb-2 cursor-pointer"
          >
            <span className="text-xs font-medium text-cyan-300 bg-slate-900/90 px-4 py-1.5 rounded-full border border-cyan-500/40 shadow-xl flex items-center gap-1.5">
              <ChevronDown className="w-4 h-4" />
              <span>نمایش کامل پاسخ طولانی</span>
            </span>
          </div>
        )}
      </div>

      {/* Toggle button for very long messages */}
      {isVeryLongMessage && (
        <div className="mt-2 text-left dir-ltr">
          <button
            type="button"
            onClick={() => setIsSectionCollapsed(!isSectionCollapsed)}
            className="text-[11px] font-sans font-medium text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-white/10 hover:bg-white/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            {isSectionCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>باز کردن پاسخ طولانی</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>کوچک کردن پاسخ طولانی</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
