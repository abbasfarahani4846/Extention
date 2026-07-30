import React, { useState, useEffect } from 'react';
import {
  Type,
  Upload,
  Palette,
  Sliders,
  Sparkles,
  ExternalLink,
  Check,
  Trash2,
  Plus,
  Globe,
  Subtitles,
  Layers,
  Bot,
  Settings2,
  Eye,
  Link,
  ArrowRightLeft,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { SubtitleStyle, CustomFont, TranslationToneSettings, TranslationTone, UILanguage } from '../types';
import { StorageService } from '../services/storageService';
import { getTranslation } from '../services/i18n';

declare var chrome: any;

interface SubtitleSettingsStudioProps {
  subtitleStyle: SubtitleStyle;
  setSubtitleStyle: (style: SubtitleStyle) => void;
  customFonts: CustomFont[];
  setCustomFonts: React.Dispatch<React.SetStateAction<CustomFont[]>>;
  toneSettings: TranslationToneSettings;
  setToneSettings: (settings: TranslationToneSettings) => void;
  uiLanguage?: UILanguage;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
}

export const SubtitleSettingsStudio: React.FC<SubtitleSettingsStudioProps> = ({
  subtitleStyle,
  setSubtitleStyle,
  customFonts,
  setCustomFonts,
  toneSettings,
  setToneSettings,
  uiLanguage = 'fa',
  targetLanguage,
  setTargetLanguage,
}) => {
  const t = getTranslation(uiLanguage);
  // Web URL straightener state
  const [inputUrl, setInputUrl] = useState<string>('https://youtu.be/M576WGiDBdQ?si=exampleTrackingCode');
  const [straightenedUrl, setStraightenedUrl] = useState<string>('');
  const [urlMessage, setUrlMessage] = useState<string>('');

  // Font upload & Web Font add state
  const [showAddFontModal, setShowAddFontModal] = useState<boolean>(false);
  const [newFontName, setNewFontName] = useState<string>('');
  const [newFontUrl, setNewFontUrl] = useState<string>('');
  const [fontUploadError, setFontUploadError] = useState<string>('');

  // Inject font-face rules into DOM `<head>` whenever customFonts change
  useEffect(() => {
    let styleTag = document.getElementById('dynamic-custom-fonts-style') as HTMLStyleElement;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-custom-fonts-style';
      document.head.appendChild(styleTag);
    }

    let cssRules = '';
    customFonts.forEach((font) => {
      if (font.dataUrl) {
        const familyName = font.fontFamily ? font.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : font.name;
        cssRules += `
          @font-face {
            font-family: '${familyName}';
            src: url('${font.dataUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          @font-face {
            font-family: '${font.name}';
            src: url('${font.dataUrl}') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `;
      } else if (font.url) {
        cssRules += `@import url('${font.url}');\n`;
      }
    });

    styleTag.textContent = cssRules;
  }, [customFonts]);

  // URL Straightener logic
  const handleStraightenUrl = (urlToFix: string) => {
    let url = urlToFix.trim();
    if (!url) {
      setStraightenedUrl('');
      setUrlMessage('');
      return;
    }

    // Fix missing protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const parsed = new URL(url);

      // Convert YouTube short links (youtu.be/xyz) to standard watch URL
      if (parsed.hostname.includes('youtu.be')) {
        const videoId = parsed.pathname.substring(1);
        url = `https://www.youtube.com/watch?v=${videoId}`;
      } else if (parsed.hostname.includes('youtube.com')) {
        // Strip unnecessary tracking parameters like ?si= or &feature=
        const videoId = parsed.searchParams.get('v');
        if (videoId) {
          url = `https://www.youtube.com/watch?v=${videoId}`;
        }
      }

      setStraightenedUrl(url);
      setUrlMessage('✅ آدرس اینترنتی با موفقیت راست‌سازی و استاندارد گردید.');
    } catch (e) {
      setStraightenedUrl(url);
      setUrlMessage('⚠️ ساختار آدرس تصحیح شد.');
    }
  };

  useEffect(() => {
    handleStraightenUrl(inputUrl);
  }, [inputUrl]);

  // Upload Font File (.ttf, .woff, .woff2)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFontUploadError('');
    if (!file) return;

    if (!file.name.match(/\.(ttf|otf|woff|woff2)$/i)) {
      setFontUploadError('لطفا فایل فونت معتبر با پسوند ttf, otf, woff یا woff2 انتخاب کنید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      const cleanFontName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\u0600-\u06FF _-]/g, ' ').trim() || 'فونت سفارشی';

      const newFont: CustomFont = {
        id: `font_file_${Date.now()}`,
        name: cleanFontName || 'فونت سفارشی',
        fontFamily: `'${cleanFontName}', sans-serif`,
        dataUrl: base64Data,
        isDefault: false,
      };

      const updated = [...customFonts, newFont];
      setCustomFonts(updated);
      StorageService.saveCustomFonts(updated);

      // Automatically apply new font to subtitle style
      setSubtitleStyle({
        ...subtitleStyle,
        fontFamily: newFont.fontFamily,
      });

      setShowAddFontModal(false);
      setNewFontName('');
    };
    reader.readAsDataURL(file);
  };

  // Add Font via Web Link
  const handleAddWebFont = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFontName.trim() || !newFontUrl.trim()) return;

    const newFont: CustomFont = {
      id: `font_web_${Date.now()}`,
      name: newFontName.trim(),
      fontFamily: `'${newFontName.trim()}', sans-serif`,
      url: newFontUrl.trim(),
      isDefault: false,
    };

    const updated = [...customFonts, newFont];
    setCustomFonts(updated);
    StorageService.saveCustomFonts(updated);

    setSubtitleStyle({
      ...subtitleStyle,
      fontFamily: newFont.fontFamily,
    });

    setShowAddFontModal(false);
    setNewFontName('');
    setNewFontUrl('');
  };

  const handleDeleteFont = (fontId: string) => {
    const updated = customFonts.filter((f) => f.id !== fontId);
    setCustomFonts(updated);
    StorageService.saveCustomFonts(updated);
  };

  return (
    <div className={`space-y-6 font-sans ${uiLanguage === 'fa' ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}>
      {/* Grid: Live Preview & YouTube Subtitle Inspection Badge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Main Column: Subtitle Live Player Preview & Font Detector */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subtitle Live Preview Canvas */}
          <div className="bg-slate-900/40 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 pb-3 border-b border-white/10 gap-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">پیش‌نمایش زنده زیرنویس روی ویدیو</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-950/60 border border-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-400">زبان مقصد:</span>
                  <select
                    value={targetLanguage}
                    onChange={(e) => {
                      setTargetLanguage(e.target.value);
                      chrome.storage.local.set({ chrome_ai_target_lang: e.target.value });
                    }}
                    className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="fa" className="bg-slate-900">فارسی (Persian)</option>
                    <option value="en" className="bg-slate-900">انگلیسی (English)</option>
                    <option value="es" className="bg-slate-900">اسپانیایی (Spanish)</option>
                    <option value="fr" className="bg-slate-900">فرانسوی (French)</option>
                    <option value="de" className="bg-slate-900">آلمانی (German)</option>
                    <option value="ar" className="bg-slate-900">عربی (Arabic)</option>
                    <option value="tr" className="bg-slate-900">ترکی (Turkish)</option>
                    <option value="ru" className="bg-slate-900">روسی (Russian)</option>
                  </select>
                </div>
                <span className="text-[11px] text-cyan-300 font-mono bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                  فونت فعال: {subtitleStyle.fontFamily.split(',')[0].replace(/'/g, '')}
                </span>
              </div>
            </div>

            {/* Simulated YouTube Video Player Stage */}
            <div className="relative w-full h-64 sm:h-72 bg-gradient-to-b from-slate-950 via-slate-900 to-black rounded-xl border border-white/10 overflow-hidden shadow-2xl flex flex-col justify-between p-4 group">
              {/* Top Video Header Overlay */}
              <div className="flex items-center justify-between text-xs text-slate-400 z-10 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <span className="font-semibold text-slate-200">YouTube Video Player Simulator</span>
                <span className="text-[10px] font-mono text-cyan-400">1080p60 Full HD</span>
              </div>

              {/* Subtitle Display Overlay (Positioned based on style) */}
              <div
                className={`w-full flex flex-col items-center justify-center transition-all duration-300 z-20 ${
                  subtitleStyle.position === 'top'
                    ? 'mt-2'
                    : subtitleStyle.position === 'middle'
                    ? 'my-auto'
                    : 'mb-2'
                }`}
              >
                <div
                  style={{
                    backgroundColor: subtitleStyle.backgroundColor,
                    borderRadius: `${subtitleStyle.borderRadius || 12}px`,
                    padding: `${subtitleStyle.paddingY || 8}px ${subtitleStyle.paddingX || 16}px`,
                    fontFamily: subtitleStyle.fontFamily,
                    fontSize: `${subtitleStyle.fontSize}px`,
                    fontWeight: subtitleStyle.fontWeight || '600',
                    textShadow: subtitleStyle.textShadow ? '0 2px 8px rgba(0,0,0,0.9)' : 'none',
                  }}
                  className="max-w-[90%] text-center space-y-1 backdrop-blur-md transition-all shadow-2xl border border-white/10 dir-auto"
                >
                  {/* Primary Language Subtitle (Persian) */}
                  {(subtitleStyle.dualLayout === 'persian_top' ||
                    subtitleStyle.dualLayout === 'persian_only' ||
                    !subtitleStyle.dualLayout) && (
                    <div style={{ color: subtitleStyle.textColor }}>
                      این یک نمونه زیرنویس فارسی هوشمند است که با فونت انتخابی شما نمایش داده می‌شود.
                    </div>
                  )}

                  {/* Secondary Language Subtitle (English) */}
                  {(subtitleStyle.showDualLanguage ||
                    subtitleStyle.dualLayout === 'english_top' ||
                    subtitleStyle.dualLayout === 'english_only') && (
                    <div
                      style={{ color: subtitleStyle.secondaryTextColor || '#38bdf8' }}
                      className="text-[0.88em] font-sans opacity-95 dir-ltr"
                    >
                      This is a live preview of AI subtitles with your customized font and position!
                    </div>
                  )}

                  {/* Reversed Order Persian if English is top */}
                  {subtitleStyle.dualLayout === 'english_top' && (
                    <div style={{ color: subtitleStyle.textColor }}>
                      این یک نمونه زیرنویس فارسی هوشمند است که در لایه دوم قرار دارد.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Video Progress Bar */}
              <div className="w-full space-y-1 z-10 bg-black/40 backdrop-blur-md p-2 rounded-lg border border-white/10">
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-2/3 h-full bg-red-600 rounded-full"></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>01:24</span>
                  <span>03:45</span>
                </div>
              </div>
            </div>

            {/* YouTube Font & Overlay Inspector Status Card */}
            <div className="mt-4 p-3.5 bg-slate-950/60 rounded-xl border border-white/10 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>وضعیت افزونه کروم: **آماده تزریق مستقیم به پخش‌کننده یوتیوب**</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-cyan-400">
                <span>موقعیت: {subtitleStyle.position}</span>
                <span>سایز: {subtitleStyle.fontSize}px</span>
                <span>جهت: {subtitleStyle.textDirection}</span>
              </div>
            </div>
          </div>

          {/* Subtitle Appearance & Position Controls */}
          <div className="bg-slate-900/40 backdrop-blur-2xl p-5 sm:p-6 rounded-2xl border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">تنظیمات ظاهری و موقعیت قرارگیری زیرنویس</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs text-slate-300">
              {/* Position Choice */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">موقعیت نمایش روی صفحه:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubtitleStyle({ ...subtitleStyle, position: 'bottom' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-medium ${
                      subtitleStyle.position === 'bottom'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    پایین (Bottom)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubtitleStyle({ ...subtitleStyle, position: 'middle' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-medium ${
                      subtitleStyle.position === 'middle'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    وسط (Middle)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubtitleStyle({ ...subtitleStyle, position: 'top' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-medium ${
                      subtitleStyle.position === 'top'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    بالا (Top)
                  </button>
                </div>
              </div>

              {/* Dual Language & Subtitle Display Mode */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">حالت نمایش زبان‌های زیرنویس:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, showDualLanguage: true, dualLayout: 'persian_top' })
                    }
                    className={`px-3 py-2 rounded-xl border transition-all text-center font-medium ${
                      (subtitleStyle.dualLayout === 'persian_top' || (!subtitleStyle.dualLayout && subtitleStyle.showDualLanguage))
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    🇮🇷 🇬🇧 دو زبانه (فارسی بالا)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, showDualLanguage: true, dualLayout: 'english_top' })
                    }
                    className={`px-3 py-2 rounded-xl border transition-all text-center font-medium ${
                      subtitleStyle.dualLayout === 'english_top'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    🇬🇧 🇮🇷 دو زبانه (انگلیسی بالا)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, showDualLanguage: false, dualLayout: 'persian_only' })
                    }
                    className={`px-3 py-2 rounded-xl border transition-all text-center font-medium ${
                      subtitleStyle.dualLayout === 'persian_only' || (!subtitleStyle.dualLayout && !subtitleStyle.showDualLanguage)
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    🇮🇷 فقط زیرنویس فارسی
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, showDualLanguage: false, dualLayout: 'english_only' })
                    }
                    className={`px-3 py-2 rounded-xl border transition-all text-center font-medium ${
                      subtitleStyle.dualLayout === 'english_only'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    🇬🇧 فقط انگلیسی (اصلی)
                  </button>
                </div>
              </div>

              {/* Font Size Slider */}
              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-1">
                  <span>اندازه قلم (Font Size):</span>
                  <span className="text-cyan-400 font-mono">{subtitleStyle.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="36"
                  step="1"
                  value={subtitleStyle.fontSize}
                  onChange={(e) =>
                    setSubtitleStyle({ ...subtitleStyle, fontSize: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>ریز (14px)</span>
                  <span>استاندارد (20px)</span>
                  <span>درشت (36px)</span>
                </div>
              </div>

              {/* Font Weight Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">ضخامت قلم (Font Weight):</label>
                <div className="grid grid-cols-5 gap-1.5 text-[11px]">
                  {[
                    { label: 'معمولی', val: '400' },
                    { label: 'متوسط', val: '500' },
                    { label: 'نیمه‌ضخیم', val: '600' },
                    { label: 'ضخیم', val: '700' },
                    { label: 'سیاه', val: '900' },
                  ].map((w) => (
                    <button
                      key={w.val}
                      type="button"
                      onClick={() => setSubtitleStyle({ ...subtitleStyle, fontWeight: w.val })}
                      className={`py-2 rounded-xl border transition-all text-center ${
                        (subtitleStyle.fontWeight || '600') === w.val || (!subtitleStyle.fontWeight && w.val === '600')
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg font-bold'
                          : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                      }`}
                      style={{ fontWeight: parseInt(w.val) }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Color & Presets */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">رنگ زمینه پس‌زمینه:</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, backgroundColor: 'rgba(0, 0, 0, 0.85)' })
                    }
                    className="px-3 py-1.5 rounded-lg bg-black text-white border border-white/20 text-[11px] cursor-pointer"
                  >
                    مشکی مشبک
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, backgroundColor: 'rgba(15, 23, 42, 0.9)' })
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-100 border border-slate-700 text-[11px] cursor-pointer"
                  >
                    سورمه‌ای دارک
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, backgroundColor: 'rgba(0, 0, 0, 0.4)' })
                    }
                    className="px-3 py-1.5 rounded-lg bg-black/40 text-slate-200 border border-white/10 text-[11px] cursor-pointer"
                  >
                    شیشه‌ای شفاف
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSubtitleStyle({ ...subtitleStyle, backgroundColor: 'transparent' })
                    }
                    className="px-3 py-1.5 rounded-lg bg-transparent text-slate-300 border border-white/20 text-[11px] cursor-pointer"
                  >
                    بدون پس‌زمینه
                  </button>
                </div>
              </div>

              {/* Text Color Picker */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">رنگ متن اصلی (فارسی):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={subtitleStyle.textColor.startsWith('#') ? subtitleStyle.textColor : '#ffffff'}
                    onChange={(e) => setSubtitleStyle({ ...subtitleStyle, textColor: e.target.value })}
                    className="w-10 h-9 rounded-lg bg-slate-950 border border-white/10 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={subtitleStyle.textColor}
                    onChange={(e) => setSubtitleStyle({ ...subtitleStyle, textColor: e.target.value })}
                    className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Secondary Language Text Color */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">رنگ متن زیرنویس انگلیسی (دوزبانه):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      subtitleStyle.secondaryTextColor?.startsWith('#')
                        ? subtitleStyle.secondaryTextColor
                        : '#38bdf8'
                    }
                    onChange={(e) =>
                      setSubtitleStyle({ ...subtitleStyle, secondaryTextColor: e.target.value })
                    }
                    className="w-10 h-9 rounded-lg bg-slate-950 border border-white/10 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={subtitleStyle.secondaryTextColor || '#38bdf8'}
                    onChange={(e) =>
                      setSubtitleStyle({ ...subtitleStyle, secondaryTextColor: e.target.value })
                    }
                    className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Text Shadows & Border Radius */}
              <div>
                <label className="block text-slate-300 font-semibold mb-2">انحنای زوایا (Border Radius):</label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={subtitleStyle.borderRadius || 12}
                  onChange={(e) =>
                    setSubtitleStyle({ ...subtitleStyle, borderRadius: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Translation Trigger & Notification Settings */}
            <div className="pt-5 mt-5 border-t border-white/10 space-y-4">
              <div>
                <label className="flex items-center gap-3 text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subtitleStyle.showTranslationPrompt !== false}
                    onChange={(e) => setSubtitleStyle({ ...subtitleStyle, showTranslationPrompt: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500 bg-slate-950 border-white/20 rounded cursor-pointer"
                  />
                  نمایش خودکار پیام پیشنهاد ترجمه در ویدیوهای یوتیوب
                </label>
                <p className="text-[11px] text-slate-500 mt-1.5 mr-7">
                  با غیرفعال کردن این گزینه، پیام پاپ‌آپ روی ویدیوهای یوتیوب نمایش داده نمی‌شود و می‌توانید به صورت دستی ترجمه را شروع کنید.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
                        if (tabs && tabs.length > 0 && tabs[0].id) {
                          chrome.tabs.sendMessage(tabs[0].id, { action: 'FORCE_START_TRANSLATION' }, (response: any) => {
                            if (chrome.runtime.lastError || !response || !response.success) {
                              alert(response?.error || 'خطا در ارتباط با صفحه. مطمئن شوید در یک ویدیوی یوتیوب هستید و صفحه را رفرش کرده‌اید.');
                            }
                          });
                        }
                      });
                    } else {
                      alert('این قابلیت فقط در محیط اکستنشن مرورگر کار می‌کند.');
                    }
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer w-full sm:w-auto"
                >
                  <Bot className="w-4 h-4" />
                  <span>ترجمه ویدیوی فعلی یوتیوب</span>
                </button>
              </div>
            </div>
          </div>

          {/* Web URL Straightener & Quick Navigation */}
          <div className="bg-slate-900/40 backdrop-blur-2xl p-5 sm:p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <Link className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                راست‌سازی و استانداردسازی آدرس اینترنتی (URL Straightener)
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              لینک ویدیو یا وب‌سایت مورد نظر را وارد کنید تا کدهای اضافه و یونیکد به کدهای استاندارد
              تبدیل شوند.
            </p>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://youtu.be/M576WGiDBdQ..."
                  className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500/60 dir-ltr text-left"
                />

                <a
                  href={straightenedUrl || inputUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer shrink-0"
                >
                  <Globe className="w-4 h-4" />
                  <span>رفتن مستقیم به سایت</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {urlMessage && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-cyan-500/30 text-xs font-mono text-cyan-300 dir-ltr text-left break-all">
                  {straightenedUrl}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Custom Font Manager & AI Subtitle Persona */}
        <div className="space-y-6">
          {/* Custom Font Manager Card */}
          <div className="bg-slate-900/40 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">مدیریت فونت‌ها و آپلود فایل</h3>
              </div>

              <button
                type="button"
                onClick={() => setShowAddFontModal(true)}
                className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                title="افزودن فونت جدید"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن فونت</span>
              </button>
            </div>

            {/* Font Selection Radio List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {customFonts.map((font) => {
                const isActive = subtitleStyle.fontFamily.includes(font.name) || subtitleStyle.fontFamily === font.fontFamily;
                return (
                  <div
                    key={font.id}
                    onClick={() =>
                      setSubtitleStyle({
                        ...subtitleStyle,
                        fontFamily: font.fontFamily,
                      })
                    }
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 backdrop-blur-md ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-lg font-bold'
                        : 'bg-slate-950/60 text-slate-300 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isActive ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-500'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="truncate">
                        <span style={{ fontFamily: font.fontFamily }} className="text-xs block truncate">
                          {font.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block truncate">
                          {font.fontFamily.split(',')[0]}
                        </span>
                      </div>
                    </div>

                    {!font.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFont(font.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                        title="حذف فونت سفارشی"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Removed AI Subtitle Tone & Persona Rules */}
        </div>
      </div>

      {/* Add Custom Font Modal */}
      {showAddFontModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Type className="w-5 h-5 text-cyan-400" />
                <span>افزودن فونت جدید</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddFontModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Upload File Section */}
            <div className="space-y-2 p-4 bg-slate-950/80 rounded-xl border border-white/10 text-center">
              <Upload className="w-8 h-8 text-cyan-400 mx-auto" />
              <p className="font-semibold text-slate-200">آپلود فایل فونت از کامپیوتر یا گوشی</p>
              <p className="text-[11px] text-slate-400">فرمت‌های پشتیبانی شده: .ttf, .otf, .woff, .woff2</p>

              <label className="inline-block px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl cursor-pointer transition-all mt-2">
                <span>انتخاب فایل فونت</span>
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fontUploadError && <p className="text-rose-400 text-[11px] mt-2">{fontUploadError}</p>}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-3 text-slate-500 text-[11px]">یا لینک وب‌فونت</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Web Font Form */}
            <form onSubmit={handleAddWebFont} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">نام فونت:</label>
                <input
                  type="text"
                  value={newFontName}
                  onChange={(e) => setNewFontName(e.target.value)}
                  placeholder="مثلا: IranSans"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">لینک CSS وب‌فونت (Google Fonts یا CDN):</label>
                <input
                  type="text"
                  value={newFontUrl}
                  onChange={(e) => setNewFontUrl(e.target.value)}
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500 dir-ltr text-left"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddFontModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!newFontName.trim() || !newFontUrl.trim()}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl disabled:opacity-50"
                >
                  ثبت وب‌فونت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
