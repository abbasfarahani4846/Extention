import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Download,
  Languages,
  Code2,
  Sliders,
  Zap,
  RotateCcw,
  BookOpen,
  Pencil,
  X,
} from 'lucide-react';
import { AIProvider, ChatMessage, ProxySettings } from '../types';
import { AIService } from '../services/aiService';
import { MarkdownMessage } from './MarkdownMessage';

interface AIChatStudioProps {
  providers: AIProvider[];
  activeProviderId: string;
  setActiveProviderId: (id: string) => void;
  activeModelId: string;
  setActiveModelId: (id: string) => void;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  proxySettings?: ProxySettings;
}

export const AIChatStudio: React.FC<AIChatStudioProps> = ({
  providers,
  activeProviderId,
  setActiveProviderId,
  activeModelId,
  setActiveModelId,
  chatHistory,
  setChatHistory,
  proxySettings,
}) => {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [systemPromptMode, setSystemPromptMode] = useState<'assistant' | 'translator' | 'code' | 'summary'>('assistant');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Message Editing state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentProvider = providers.find((p) => p.id === activeProviderId) || providers[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isGenerating]);

  const getSystemPrompt = () => {
    if (customSystemPrompt.trim()) return customSystemPrompt;

    switch (systemPromptMode) {
      case 'translator':
        return 'You are an elite bilingual translator. Translate given inputs into fluent, idiomatic, natural Persian (Farsi) or English as requested. Provide clean, well-structured output without conversational clutter.';
      case 'code':
        return 'You are an expert Senior Full-Stack Software Engineer specializing in React, TypeScript, Python, and Chrome Extension Manifest V3 architecture. Provide modular, bug-free code examples with concise comments.';
      case 'summary':
        return 'You are a professional content summarizer. Extract key concepts, actionable takeaways, and clear bullet points from provided text or web content in clear Persian.';
      case 'assistant':
      default:
        return 'You are an intelligent, helpful AI assistant built into the Chrome AI Companion extension. Respond accurately, politely, and effectively in Persian (Farsi). Use formatted Markdown for code and structure.';
    }
  };

  const executeAIGeneration = async (messagesContext: ChatMessage[]) => {
    setIsGenerating(true);
    try {
      const formattedHistory = messagesContext.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const responseText = await AIService.generateText({
        provider: currentProvider,
        modelId: activeModelId,
        messages: formattedHistory,
        systemPrompt: getSystemPrompt(),
        temperature,
        proxySettings,
      });

      const aiMessage: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        modelUsed: activeModelId,
        providerUsed: currentProvider.name,
      };

      setChatHistory((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Error generating chat response:', error);
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ خطا در دریافت پاسخ از مدل: ${error?.message || 'مشکلی رخ داده است.'}`,
        timestamp: Date.now(),
        modelUsed: activeModelId,
        providerUsed: currentProvider.name,
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

  // Edit user message and re-send to AI
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

    // Cut history up to this message, updating its content
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

  // Delete individual message from history
  const handleDeleteSingleMessage = (msgId: string) => {
    setChatHistory((prev) => prev.filter((m) => m.id !== msgId));
  };

  // Regenerate response for the last user prompt or from specific index
  const handleRegenerate = async (msgIndex: number) => {
    if (isGenerating) return;

    // Find closest user message at or before this index
    let userMsgIdx = msgIndex;
    while (userMsgIdx >= 0 && chatHistory[userMsgIdx].role !== 'user') {
      userMsgIdx--;
    }

    if (userMsgIdx < 0) return;

    // Trim history up to and including that user message
    const trimmedHistory = chatHistory.slice(0, userMsgIdx + 1);
    setChatHistory(trimmedHistory);

    await executeAIGeneration(trimmedHistory);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm('آیا از پاکسازی تمام تاریخچه چت اطمینان دارید؟')) {
      setChatHistory([]);
    }
  };

  const handleExportChat = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(chatHistory, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `ai_chat_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] sm:h-[calc(100vh-150px)] dir-rtl text-right font-sans gap-3">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900/40 backdrop-blur-2xl p-4 sm:p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          {/* Controls: Provider Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full justify-end">
            {/* Active Provider & Model Dropdown */}
            <div className="flex items-center gap-2 bg-slate-950/60 border border-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs flex-1 sm:flex-none">
              <Bot className="w-4 h-4 text-cyan-400 shrink-0" />
              <select
                value={activeProviderId}
                onChange={(e) => setActiveProviderId(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer w-full"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Parameter Settings Trigger */}
            <button
              onClick={() => setShowSettingsModal(!showSettingsModal)}
              className={`p-2 rounded-xl text-xs font-medium border backdrop-blur-md transition-all cursor-pointer ${
                showSettingsModal
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-950/60 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
              title="تنظیمات دمای پاسخ و پرامپت سیستمی"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Export Chat */}
            <button
              onClick={handleExportChat}
              disabled={chatHistory.length === 0}
              className="p-2 bg-slate-950/60 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-medium transition-all cursor-pointer disabled:opacity-40"
              title="خروجی گرفتن از چت (JSON)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Clear Chat */}
            <button
              onClick={handleClearHistory}
              disabled={chatHistory.length === 0}
              className="p-2 bg-slate-950/60 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 border border-white/10 hover:border-rose-500/30 rounded-xl text-xs font-medium transition-all cursor-pointer disabled:opacity-40"
              title="پاکسازی تمام گفتگوها"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Parameters Modal Drawer */}
        {showSettingsModal && (
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                دمای تولید پاسخ (Temperature: {temperature})
              </label>
              <input
                type="range"
                min="0.1"
                max="1.2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>دقیق و مستند (0.1)</span>
                <span>خلاقانه و آزاد (1.2)</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                دستورالعمل سیستمی سفارشی (Custom System Prompt)
              </label>
              <input
                type="text"
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                placeholder="مثلا: مانند یک مهندس ارشد شیراز پاسخ بده..."
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          </div>
        )}

        {/* Persona Mode Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 border-t border-white/10 text-xs">
          <span className="text-slate-400 shrink-0 text-[11px]">حالت‌های هوش مصنوعی:</span>
          <button
            onClick={() => {
              setSystemPromptMode('assistant');
              setCustomSystemPrompt('');
            }}
            className={`px-3 py-1 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer ${
              systemPromptMode === 'assistant' && !customSystemPrompt
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                : 'bg-slate-950/40 text-slate-400 border-white/10 hover:bg-white/5'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>دستیار عمومی</span>
          </button>

          <button
            onClick={() => {
              setSystemPromptMode('translator');
              setCustomSystemPrompt('');
            }}
            className={`px-3 py-1 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer ${
              systemPromptMode === 'translator' && !customSystemPrompt
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                : 'bg-slate-950/40 text-slate-400 border-white/10 hover:bg-white/5'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>مترجم تخصصی</span>
          </button>

          <button
            onClick={() => {
              setSystemPromptMode('code');
              setCustomSystemPrompt('');
            }}
            className={`px-3 py-1 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer ${
              systemPromptMode === 'code' && !customSystemPrompt
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                : 'bg-slate-950/40 text-slate-400 border-white/10 hover:bg-white/5'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>برنامه‌نویس Senior</span>
          </button>

          <button
            onClick={() => {
              setSystemPromptMode('summary');
              setCustomSystemPrompt('');
            }}
            className={`px-3 py-1 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer ${
              systemPromptMode === 'summary' && !customSystemPrompt
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                : 'bg-slate-950/40 text-slate-400 border-white/10 hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>خلاصه‌ساز حرفه‌ای</span>
          </button>
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="bg-slate-900/40 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 backdrop-blur-md">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-white">به چت استودیوی هوش مصنوعی خوش آمدید!</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  سؤال خود را بپرسید تا با مدل فعال ({activeModelId.split('/').pop()}) گفتگو کنید.
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg pt-2 text-xs">
                <button
                  onClick={() => handleSendMessage('معماری Chrome Extension Manifest V3 چه تفاوت‌هایی با V2 دارد؟')}
                  className="p-3 bg-slate-950/50 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-xl text-slate-300 hover:text-cyan-300 text-right transition-all backdrop-blur-md cursor-pointer flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>تفاوت مانیفست v3 و v2 چیست؟</span>
                </button>

                <button
                  onClick={() => handleSendMessage('چگونه زیرنویس یوتیوب را به صورت هوشمند خلاصه‌سازی کنیم؟')}
                  className="p-3 bg-slate-950/50 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-xl text-slate-300 hover:text-cyan-300 text-right transition-all backdrop-blur-md cursor-pointer flex items-center gap-2"
                >
                  <Languages className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>خلاصه کردن زیرنویس ویدیوها</span>
                </button>

                <button
                  onClick={() => handleSendMessage('یک هوک استاندارد React برای مدیریت کلیدهای LocalStorage بنویس.')}
                  className="p-3 bg-slate-950/50 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-xl text-slate-300 hover:text-cyan-300 text-right transition-all backdrop-blur-md cursor-pointer flex items-center gap-2"
                >
                  <Code2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>نوشتن هوک custom React</span>
                </button>

                <button
                  onClick={() => handleSendMessage('بهترین تکنیک‌ها برای کاهش مصرف توکن در API چیست؟')}
                  className="p-3 bg-slate-950/50 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 rounded-xl text-slate-300 hover:text-cyan-300 text-right transition-all backdrop-blur-md cursor-pointer flex items-center gap-2"
                >
                  <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>تکنیک‌های بهینه‌سازی توکن</span>
                </button>
              </div>
            </div>
          ) : (
            chatHistory.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isEditingThis = editingMsgId === msg.id;

              return (
                <div
                  key={msg.id || index}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* User / AI Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border backdrop-blur-md ${
                      isUser
                        ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                        : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble Container */}
                  <div
                    className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xl relative group backdrop-blur-xl ${
                      isUser
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-50 rounded-tr-none'
                        : 'bg-slate-950/70 text-slate-100 border border-white/10 rounded-tl-none'
                    }`}
                  >
                    {/* Header line for AI Messages */}
                    {!isUser && msg.modelUsed && (
                      <div className="text-[11px] text-cyan-400 font-mono mb-2 pb-1.5 border-b border-white/10 flex items-center justify-between gap-2">
                        <span className="font-bold">{msg.providerUsed || 'AI'}</span>
                        <span className="text-slate-400 truncate dir-ltr">{msg.modelUsed}</span>
                      </div>
                    )}

                    {/* Inline Editing Mode for User Messages */}
                    {isEditingThis ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-950/90 border border-cyan-500/60 rounded-xl p-2.5 text-xs text-white focus:outline-none font-sans leading-relaxed dir-auto"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={handleCancelEdit}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>انصراف</span>
                          </button>

                          <button
                            onClick={() => handleSaveAndResendEdit(msg.id)}
                            disabled={!editingText.trim() || isGenerating}
                            className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5 rotate-180" />
                            <span>ثبت و ارسال مجدد</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Message Content with Markdown */
                      <MarkdownMessage content={msg.content} />
                    )}

                    {/* Footer Actions & Timestamp */}
                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString('fa-IR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                        {/* Copy button */}
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                          title="کپی متن"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* User Edit message button */}
                        {isUser && !isEditingThis && (
                          <button
                            onClick={() => handleStartEdit(msg)}
                            className="p-1 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-colors cursor-pointer"
                            title="ویرایش این پیام و ارسال مجدد به هوش مصنوعی"
                          >
                            <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                          </button>
                        )}

                        {/* Regenerate AI answer */}
                        {!isUser && (
                          <button
                            onClick={() => handleRegenerate(index)}
                            className="p-1 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-colors cursor-pointer"
                            title="بازتولید و ارسال مجدد این پاسخ"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                          </button>
                        )}

                        {/* Delete message button */}
                        <button
                          onClick={() => handleDeleteSingleMessage(msg.id)}
                          className="p-1 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                          title="حذف این پیام"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* AI Generating Indicator */}
          {isGenerating && (
            <div className="flex items-center gap-3 text-xs text-slate-300 bg-slate-950/80 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 w-fit">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>پاسخ هوش مصنوعی با {currentProvider.name} در حال دریافت است...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-950/80 backdrop-blur-2xl border-t border-white/10">
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
              placeholder="پیام یا سؤال خود را بنویسید..."
              disabled={isGenerating}
              autoFocus
              className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 backdrop-blur-md disabled:opacity-50 dir-auto"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              className="px-4 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl disabled:opacity-40 transition-all cursor-pointer backdrop-blur-md flex items-center gap-1.5 font-semibold text-xs shrink-0"
            >
              <span>ارسال</span>
              <Send className="w-4 h-4 rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
