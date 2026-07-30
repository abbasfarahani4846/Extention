import React, { useState, useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { AILog, AILogSettings, AILogType } from '../types';

interface AILogsViewerProps {
  logs: AILog[];
  onClearLogs: () => void;
  logSettings: AILogSettings;
  onUpdateSettings: (settings: AILogSettings) => void;
}

export function AILogsViewer({ logs, onClearLogs, logSettings, onUpdateSettings }: AILogsViewerProps) {
  const [filterType, setFilterType] = useState<AILogType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'pending'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType !== 'all' && log.type !== filterType) return false;
      if (filterStatus !== 'all' && log.status !== filterStatus) return false;
      return true;
    });
  }, [logs, filterType, filterStatus]);

  const toggleExpand = (id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  const handleMaxLogsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMax = parseInt(e.target.value, 10);
    onUpdateSettings({ ...logSettings, maxLogs: newMax });
  };

  const getTypeLabel = (type: AILogType) => {
    switch (type) {
      case 'chat': return '💬 چت';
      case 'subtitle_translate': return '📝 ترجمه تکی';
      case 'subtitle_batch': return '📑 ترجمه دسته‌ای';
      default: return type;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] lg:h-[calc(100vh-140px)] bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl dir-rtl">
      
      {/* Header & Controls */}
      <div className="p-4 border-b border-white/10 bg-slate-900/80 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📊 لاگ درخواست‌های هوش مصنوعی
          </h2>
          <p className="text-xs text-slate-400 mt-1">مشاهده و بررسی درخواست‌های ارسال شده به سرویس‌دهنده‌ها</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-white outline-none focus:border-cyan-500"
          >
            <option value="all">همه نوع درخواست</option>
            <option value="chat">چت</option>
            <option value="subtitle_translate">ترجمه تکی</option>
            <option value="subtitle_batch">ترجمه دسته‌ای</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-white outline-none focus:border-cyan-500"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="success">✅ موفق</option>
            <option value="error">❌ خطا</option>
            <option value="pending">⏳ در حال ارسال</option>
          </select>

          <select
            value={logSettings.maxLogs}
            onChange={handleMaxLogsChange}
            className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-white outline-none focus:border-cyan-500"
          >
            <option value="50">نگهداری ۵۰ لاگ</option>
            <option value="100">نگهداری ۱۰۰ لاگ</option>
            <option value="200">نگهداری ۲۰۰ لاگ</option>
            <option value="500">نگهداری ۵۰۰ لاگ</option>
            <option value="1000">نگهداری ۱۰۰۰ لاگ</option>
          </select>

          <button
            onClick={() => {
              if (window.confirm('آیا از پاک کردن تمام لاگ‌ها مطمئن هستید؟')) {
                onClearLogs();
              }
            }}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            🗑️ پاک کردن
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500">
            هیچ لاگی برای نمایش وجود ندارد.
          </div>
        ) : (
          filteredLogs.map(log => {
            const isExpanded = expandedLogId === log.id;
            const hasError = log.status === 'error';
            const isPending = log.status === 'pending';
            
            return (
              <div key={log.id} className={`border rounded-xl overflow-hidden transition-colors ${hasError ? 'border-red-500/30 bg-red-500/5' : isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-slate-800/40'}`}>
                
                {/* Log Header (Clickable) */}
                <div 
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 cursor-pointer hover:bg-white/5"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex items-center gap-3">
                    {isPending ? (
                      <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
                    ) : (
                      <span className="text-xl">{hasError ? '❌' : '✅'}</span>
                    )}
                    <div>
                      <div className="font-semibold text-white flex items-center gap-2">
                        {getTypeLabel(log.type)}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                          {log.providerName || log.providerId} ({log.modelId.split('/').pop()})
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex gap-2">
                        <span>{new Date(log.timestamp).toLocaleString('fa-IR')}</span>
                        {log.durationMs && <span>• زمان پاسخ: {log.durationMs} میلی‌ثانیه</span>}
                        {isPending && <span className="text-amber-400">• در حال پردازش...</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 sm:mt-0">
                    <button className="text-slate-400 hover:text-white px-2 text-sm">
                      {isExpanded ? '🔼 بستن' : '🔽 جزئیات'}
                    </button>
                  </div>
                </div>

                {/* Log Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-white/10 bg-slate-900/50 space-y-4">
                    
                    {/* Error Box */}
                    {hasError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-200 text-sm whitespace-pre-wrap">
                        <strong className="text-red-400 block mb-1">خطا:</strong>
                        {log.error}
                      </div>
                    )}

                    {/* Request Messages */}
                    <div>
                      <strong className="text-cyan-400 text-sm mb-2 block">پیام‌های ارسالی (Request):</strong>
                      <div className="space-y-2">
                        {log.requestMessages.map((msg, i) => (
                          <div key={i} className="bg-slate-950 rounded-lg p-3 text-sm border border-slate-800">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs mb-2 font-bold ${
                              msg.role === 'system' ? 'bg-purple-500/20 text-purple-300' :
                              msg.role === 'user' ? 'bg-blue-500/20 text-blue-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {msg.role.toUpperCase()}
                            </span>
                            <pre className="text-slate-300 whitespace-pre-wrap font-sans text-xs sm:text-sm">
                              {msg.content}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Response */}
                    {log.responseContent && (
                      <div>
                        <strong className="text-green-400 text-sm mb-2 block">پاسخ دریافتی (Response):</strong>
                        <div className="bg-slate-950 rounded-lg p-3 text-sm border border-slate-800">
                          <pre className="text-slate-300 whitespace-pre-wrap font-sans text-xs sm:text-sm">
                            {log.responseContent}
                          </pre>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
