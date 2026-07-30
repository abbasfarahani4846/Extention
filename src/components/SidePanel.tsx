import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  X,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Languages,
  Code2,
  RefreshCw,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { AIProvider, ChatMessage, ProxySettings } from '../types';
import { AIService } from '../services/aiService';
import { MarkdownMessage } from './MarkdownMessage';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  providers: AIProvider[];
  activeProviderId: string;
  setActiveProviderId: (id: string) => void;
  activeModelId: string;
  setActiveModelId: (modelId: string) => void;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  proxySettings?: ProxySettings;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  providers,
  activeProviderId,
  setActiveProviderId,
  activeModelId,
  setActiveModelId,
  chatHistory,
  setChatHistory,
  proxySettings,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [systemPromptMode, setSystemPromptMode] = useState<string>('assistant');

  // Edit Message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentProvider = providers.find((p) => p.id === activeProviderId) || providers[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [chatHistory, isOpen, isGenerating]);

  const getSystemPrompt = () => {
    let sysPrompt = 'شما یک دستیار هوش مصنوعی هوشمند و با ادب هستید. پاسخ‌های خود را ترجیحاً به زبان فارسی شیوا و روان ارائه دهید و از ساختار مارک‌داون برای کدها استفاده کنید.';
    if (systemPromptMode === 'translator') {
      sysPrompt = 'شما یک مترجم متخصص ویدیو و متن هستید. متن‌های ورودی را به فارسی روان، بدون زیاده‌گویی ترجمه کنید.';
    } else if (systemPromptMode === 'code') {
      sysPrompt = 'شما یک مهندس ارشد نرم‌افزار هستید. قطعات کد و معمار‌های فنی را به صورت کامل و تمیز با مثال کد مارک‌داون توضیح دهید.';
    }
    return sysPrompt;
  };

  const executeAIGeneration = async (messagesContext: ChatMessage[]) => {
    setIsGenerating(true);
    try {
      const conversation = messagesContext.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const assistantReply = await AIService.generateText({
        provider: currentProvider,
        modelId: activeModelId,
        messages: conversation,
        systemPrompt: getSystemPrompt(),
        proxySettings,
      });

      const assistantMessage: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: assistantReply,
        timestamp: Date.now(),
        modelUsed: activeModelId,
        providerUsed: currentProvider.name,
      };

      setChatHistory((prev) => [...prev, assistantMessage]);
    } catch (e: any) {
      console.error('Chat generation error in SidePanel:', e);
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ خطا در دریافت پاسخ: ${e?.message || 'پاسخی دریافت نشد.'}`,
        timestamp: Date.now(),
      };
      setChatHistory((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    if (!textToSend) setInputText('');

    await executeAIGeneration(newHistory);
  };

  // User edit message and re-send to AI
  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditingText('');
  };

  const handleSaveAndResendEdit = async (msgId: string) => {
    if (!editingText.trim() || isGenerating) return;

    const msgIndex = chatHistory.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const updatedUserMsg: ChatMessage = {
      ...chatHistory[msgIndex],
      content: editingText.trim(),
      timestamp: Date.now(),
    };

    const trimmedHistory = [...chatHistory.slice(0, msgIndex), updatedUserMsg];
    setChatHistory(trimmedHistory);
    setEditingMsgId(null);
    setEditingText('');

    await executeAIGeneration(trimmedHistory);
  };

  // Delete single message from history
  const handleDeleteSingleMessage = (msgId: string) => {
    setChatHistory((prev) => prev.filter((m) => m.id !== msgId));
  };

  // Regenerate response
  const handleRegenerate = async (msgIndex: number) => {
    if (isGenerating) return;

    let userMsgIdx = msgIndex;
    while (userMsgIdx >= 0 && chatHistory[userMsgIdx].role !== 'user') {
      userMsgIdx--;
    }

    if (userMsgIdx < 0) return;

    const trimmedHistory = chatHistory.slice(0, userMsgIdx + 1);
    setChatHistory(trimmedHistory);

    await executeAIGeneration(trimmedHistory);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm('آیا از پاک کردن تاریخچه گفتگو اطمینان دارید؟')) {
      setChatHistory([
        {
          id: 'welcome_reset',
          role: 'assistant',
          content: 'تاریخچه چت پاک شد. پیام جدید خود را بنویسید!',
          timestamp: Date.now(),
        },
      ]);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl shadow-cyan-950/30 flex flex-col transition-all duration-300 dir-rtl pb-16 sm:pb-0">
      {/* SidePanel Header */}
      <div className="p-4 border-b border-white/10 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-md flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              <span>دستیار هوش مصنوعی</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30 font-mono">
                SidePanel
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">اتصال لایو به مودم هوش مصنوعی</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="پاکسازی تمام چت‌ها"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="بستن پنل"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Model & System Mode Selectors */}
      <div className="p-3 bg-slate-950/30 border-b border-white/10 space-y-2 backdrop-blur-md">
        {/* Model Switcher Dropdown */}
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="text-slate-400 shrink-0">مدل فعال:</span>
          <select
            value={activeProviderId}
            onChange={(e) => setActiveProviderId(e.target.value)}
            className="bg-slate-950/60 border border-white/10 text-slate-200 text-xs rounded-xl px-2.5 py-1 font-mono focus:outline-none focus:border-cyan-500/60 backdrop-blur-md cursor-pointer"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Context Shortcuts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <button
            onClick={() => setSystemPromptMode('assistant')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap transition-colors border cursor-pointer ${
              systemPromptMode === 'assistant'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-medium'
                : 'bg-slate-900/40 border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            <Bot className="w-3 h-3" />
            <span>چت عمومی</span>
          </button>

          <button
            onClick={() => setSystemPromptMode('translator')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap transition-colors border cursor-pointer ${
              systemPromptMode === 'translator'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-medium'
                : 'bg-slate-900/40 border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            <Languages className="w-3 h-3" />
            <span>مترجم فارسی</span>
          </button>

          <button
            onClick={() => setSystemPromptMode('code')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap transition-colors border cursor-pointer ${
              systemPromptMode === 'code'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-medium'
                : 'bg-slate-900/40 border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>توضیح کد</span>
          </button>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isEditingThis = editingMsgId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-lg relative group backdrop-blur-xl ${
                  isUser
                    ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-50 rounded-tr-none'
                    : 'bg-slate-900/70 text-slate-100 border border-white/10 rounded-tl-none'
                }`}
              >
                {!isUser && msg.modelUsed && (
                  <div className="text-[10px] text-cyan-400 font-mono mb-1.5 pb-1 border-b border-white/10 flex items-center justify-between">
                    <span>{msg.providerUsed}</span>
                    <span>{msg.modelUsed.split('/').pop()}</span>
                  </div>
                )}

                {/* Inline Editing for User Messages */}
                {isEditingThis ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-950/90 border border-cyan-500/60 rounded-xl p-2 text-xs text-white focus:outline-none font-sans leading-relaxed dir-auto"
                    />
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition-colors cursor-pointer"
                      >
                        انصراف
                      </button>

                      <button
                        onClick={() => handleSaveAndResendEdit(msg.id)}
                        disabled={!editingText.trim() || isGenerating}
                        className="px-2.5 py-0.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-[11px] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        <Send className="w-3 h-3 rotate-180" />
                        <span>ارسال مجدد</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <MarkdownMessage content={msg.content} />
                )}

                <div className="mt-2.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    {new Date(msg.timestamp || Date.now()).toLocaleTimeString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopyText(msg.id, msg.content)}
                      className="p-1 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                      title="کپی متن"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    {isUser && !isEditingThis && (
                      <button
                        onClick={() => handleStartEdit(msg)}
                        className="p-1 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                        title="ویرایش پیام"
                      >
                        <Pencil className="w-3 h-3 text-cyan-400" />
                      </button>
                    )}

                    {!isUser && (
                      <button
                        onClick={() => handleRegenerate(index)}
                        className="p-1 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                        title="ارسال مجدد"
                      >
                        <RotateCcw className="w-3 h-3 text-cyan-400" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteSingleMessage(msg.id)}
                      className="p-1 hover:text-rose-400 rounded transition-colors cursor-pointer"
                      title="حذف پیام"
                    >
                      <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 w-fit">
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>در حال نوشتن پاسخ با {currentProvider.name}...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Action Suggestions */}
      <div className="px-4 py-2 bg-slate-950/40 border-t border-white/10 backdrop-blur-md flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <button
          onClick={() => handleSendMessage('ویدیو و متن صفحه را خلاصه‌سازی کن.')}
          className="px-2.5 py-1 bg-slate-900/50 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl whitespace-nowrap transition-colors cursor-pointer"
        >
          📝 خلاصه صفحه
        </button>
        <button
          onClick={() => handleSendMessage('زیرنویس‌های انگلیسی را به فارسی روان ترجمه کن.')}
          className="px-2.5 py-1 bg-slate-900/50 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl whitespace-nowrap transition-colors cursor-pointer"
        >
          🇮🇷 ترجمه زیرنویس
        </button>
        <button
          onClick={() => handleSendMessage('نکات کلیدی کاربردی این محتوا را فهرست کن.')}
          className="px-2.5 py-1 bg-slate-900/50 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl whitespace-nowrap transition-colors cursor-pointer"
        >
          💡 نکات کلیدی
        </button>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-950/60 backdrop-blur-xl border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="سوال خود را بنویسید..."
            disabled={isGenerating}
            className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 backdrop-blur-md disabled:opacity-50 dir-auto"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className="p-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl disabled:opacity-50 transition-colors cursor-pointer backdrop-blur-md"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </div>
    </aside>
  );
};
