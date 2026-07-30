import React, { useState } from 'react';
import {
  Download,
  FileCode,
  Copy,
  Check,
  FolderArchive,
  Terminal,
  ExternalLink,
  Layers,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { ExtensionFile } from '../types';
import { generateExtensionFiles, downloadExtensionZip } from '../services/extensionGenerator';

export const ExtensionExporter: React.FC = () => {
  const [extensionFiles] = useState<ExtensionFile[]>(generateExtensionFiles());
  const [selectedFilename, setSelectedFilename] = useState<string>('manifest.json');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const selectedFile = extensionFiles.find((f) => f.filename === selectedFilename) || extensionFiles[0];

  const handleCopyCode = (content: string, filename: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Top Banner */}
      <div className="bg-slate-900/40 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30 backdrop-blur-md">
                <FolderArchive className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                کد کامل افزونه کروم (Chrome Extension Manifest V3)
              </h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              تمام سورس‌کدهای اصلی افزونه کروم ایجاد شده‌اند. می‌توانید کدهای هر فایل را مشاهده، کپی کرده و یا پکیج آماده نصب (.ZIP) را دانلود و مستقیماً در مرورگر Chrome لود کنید.
            </p>
          </div>

          <button
            onClick={downloadExtensionZip}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 backdrop-blur-md font-bold text-xs rounded-xl shadow-xl shadow-emerald-950/30 transition-all cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>دانلود کل پکیج افزونه (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* Code Browser Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* File Navigator List */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            فایل‌های افزونه (Source Files)
          </h3>

          <div className="space-y-1.5">
            {extensionFiles.map((file) => {
              const isSelected = file.filename === selectedFilename;

              return (
                <button
                  key={file.filename}
                  onClick={() => setSelectedFilename(file.filename)}
                  className={`w-full p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer backdrop-blur-md ${
                    isSelected
                      ? 'bg-slate-800/60 border-cyan-500/80 shadow-md text-white'
                      : 'bg-slate-900/30 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <FileCode
                      className={`w-4 h-4 shrink-0 ${
                        file.filename.endsWith('.json')
                          ? 'text-amber-400'
                          : file.filename.endsWith('.js')
                          ? 'text-cyan-400'
                          : 'text-emerald-400'
                      }`}
                    />
                    <div className="overflow-hidden">
                      <div className="font-mono text-xs text-white truncate dir-ltr text-right">
                        {file.filename}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{file.description}</div>
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-950/60 rounded-md text-slate-400 border border-white/10">
                    {file.type}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Chrome Installation Instructions */}
          <div className="p-4 bg-slate-900/40 backdrop-blur-2xl rounded-2xl border border-white/10 space-y-2 mt-4 shadow-xl">
            <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              <span>راهنمای نصب سریع در کروم:</span>
            </h4>
            <ol className="text-[11px] text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>فایل ZIP را دانلود و اکسترکت کنید.</li>
              <li>
                در مرورگر کروم به آدرس <code className="text-cyan-300 dir-ltr">chrome://extensions</code> بروید.
              </li>
              <li>گزینه <strong>Developer mode</strong> در بالا راست را روشن کنید.</li>
              <li>روی <strong>Load unpacked</strong> کلیک کرده و پوشه اکسترکت شده را انتخاب کنید.</li>
            </ol>
          </div>
        </div>

        {/* Code Viewer Panel */}
        <div className="lg:col-span-8 space-y-3">
          {selectedFile && (
            <div className="bg-slate-950/80 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="p-3.5 bg-slate-900/60 backdrop-blur-md border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-xs text-white font-bold dir-ltr">
                    {selectedFile.filename}
                  </span>
                  <span className="text-xs text-slate-400">({selectedFile.description})</span>
                </div>

                <button
                  onClick={() => handleCopyCode(selectedFile.content, selectedFile.filename)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer border border-white/10 backdrop-blur-md"
                >
                  {copiedFile === selectedFile.filename ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی کد</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Box */}
              <div className="p-4 overflow-x-auto max-h-[500px]">
                <pre className="font-mono text-xs text-cyan-200 leading-relaxed dir-ltr text-left selection:bg-cyan-900">
                  {selectedFile.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
