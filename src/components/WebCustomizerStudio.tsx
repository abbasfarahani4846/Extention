/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Globe, Type, AlignRight, Check, Shield, Sparkles, Monitor, Power, Plus, Trash2, MousePointer, Filter } from 'lucide-react';
import { CustomFont, SubtitleStyle, WebCustomizerSettings } from '../types';
import { StorageService, DEFAULT_CUSTOM_FONTS } from '../services/storageService';

declare var chrome: any;

interface WebCustomizerStudioProps {
  customFonts: CustomFont[];
  subtitleStyle: SubtitleStyle;
  isPopup?: boolean;
}

export const WebCustomizerStudio: React.FC<WebCustomizerStudioProps> = ({
  customFonts,
  subtitleStyle,
  isPopup,
}) => {
  const [settings, setSettings] = useState<WebCustomizerSettings>(() =>
    StorageService.getWebCustomizerSettings()
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [editScope, setEditScope] = useState<'global' | 'domain'>('global');

  // Auto detect current active tab domain in Chrome Extension
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs && tabs[0] && tabs[0].url) {
          try {
            const url = new URL(tabs[0].url);
            if (url.hostname && !url.hostname.includes('chrome-extension://')) {
              const cleanHost = url.hostname.toLowerCase().replace(/^www\./, '');
              setSettings((prev) => ({ ...prev, currentSiteDomain: cleanHost }));
            }
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });
    }
  }, []);

  const handleSave = (newSettings: WebCustomizerSettings) => {
    setSettings(newSettings);
    StorageService.saveWebCustomizerSettings(newSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const currentDomain = settings.currentSiteDomain || 'دامنه جاری';
  const hasDomainOverride = !!(settings.domainOverrides && settings.domainOverrides[currentDomain]);
  const activeDomainSettings = hasDomainOverride ? (settings.domainOverrides![currentDomain] || {}) : {};

  const isDomainMode = editScope === 'domain';
  const displayFontId = isDomainMode ? (activeDomainSettings.selectedFontId || settings.selectedFontId) : settings.selectedFontId;
  const displayFontEnabled = isDomainMode ? (activeDomainSettings.fontEnabled !== undefined ? activeDomainSettings.fontEnabled : settings.fontEnabled) : settings.fontEnabled;
  const displayRtlEnabled = isDomainMode ? (activeDomainSettings.rtlEnabled !== undefined ? activeDomainSettings.rtlEnabled : settings.rtlEnabled) : settings.rtlEnabled;
  const displayFontSizeScale = isDomainMode ? (activeDomainSettings.fontSizeScale !== undefined ? activeDomainSettings.fontSizeScale : settings.fontSizeScale) : (settings.fontSizeScale || 100);
  const displayTextFontSizeScale = isDomainMode ? (activeDomainSettings.textFontSizeScale !== undefined ? activeDomainSettings.textFontSizeScale : settings.textFontSizeScale) : (settings.textFontSizeScale || 100);
  const displayInputsRtl = isDomainMode ? (activeDomainSettings.inputsRtl !== undefined ? activeDomainSettings.inputsRtl : settings.inputsRtl) : (settings.inputsRtl !== false);
  const displayFontWeight = isDomainMode ? (activeDomainSettings.fontWeight || settings.fontWeight || 'default') : (settings.fontWeight || 'default');
  const displayLineHeight = isDomainMode ? (activeDomainSettings.lineHeight || settings.lineHeight || 'default') : (settings.lineHeight || 'default');
  const displayRtlMode = isDomainMode ? (activeDomainSettings.rtlMode || settings.rtlMode) : settings.rtlMode;

  const currentDomainSelectors = (activeDomainSettings.customRtlSelectors && Array.isArray(activeDomainSettings.customRtlSelectors))
    ? activeDomainSettings.customRtlSelectors
    : ((settings.customRtlSelectors && settings.customRtlSelectors[currentDomain]) || []);

  const updateSetting = (key: string, value: any) => {
    if (isDomainMode) {
      const currentOverrides = { ...(settings.domainOverrides || {}) };
      const hostOverride = { ...(currentOverrides[currentDomain] || {}), [key]: value };
      handleSave({
        ...settings,
        domainOverrides: {
          ...currentOverrides,
          [currentDomain]: hostOverride,
        },
      });
    } else {
      handleSave({
        ...settings,
        [key]: value,
      });
    }
  };

  const handleRemoveDomainOverride = () => {
    const currentOverrides = { ...(settings.domainOverrides || {}) };
    delete currentOverrides[currentDomain];
    handleSave({
      ...settings,
      domainOverrides: currentOverrides,
    });
  };

  const addDomain = (type: 'exclude' | 'include', domainToAdd?: string) => {
    const d = (domainToAdd || newDomainInput).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!d) return;
    if (type === 'exclude') {
      const list = settings.excludedDomains || [];
      if (!list.includes(d)) {
        handleSave({ ...settings, excludedDomains: [...list, d] });
      }
    } else {
      const list = settings.includedDomains || [];
      if (!list.includes(d)) {
        handleSave({ ...settings, includedDomains: [...list, d] });
      }
    }
    if (!domainToAdd) setNewDomainInput('');
  };

  const removeDomain = (type: 'exclude' | 'include', domainToRemove: string) => {
    if (type === 'exclude') {
      const list = (settings.excludedDomains || []).filter((d) => d !== domainToRemove);
      handleSave({ ...settings, excludedDomains: list });
    } else {
      const list = (settings.includedDomains || []).filter((d) => d !== domainToRemove);
      handleSave({ ...settings, includedDomains: list });
    }
  };

  const startElementPicker = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "START_RTL_PICKER" }, () => {
            if (isPopup && typeof window !== 'undefined' && window.close) {
              window.close();
            }
          });
        }
      });
    }
  };

  // Combine custom fonts and default fonts for dropdown
  const allFonts = [
    ...DEFAULT_CUSTOM_FONTS,
    ...customFonts.filter((f) => !DEFAULT_CUSTOM_FONTS.some((df) => df.id === f.id)),
  ];

  const selectedFontObj = allFonts.find((f) => f.id === displayFontId) || allFonts[0];

  return (
    <div className="space-y-4 dir-rtl text-right font-sans max-w-4xl mx-auto">
      {/* Sleek Minimal Top Header */}
      <div className="bg-slate-900/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/10 shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30 shrink-0">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white">سفارشی‌ساز ظاهر و راست‌چین سایت‌ها</h2>
            <p className="text-[11px] text-slate-400">اعمال فونت فارسی و چیدمان RTL روی صفحات وب</p>
          </div>
        </div>

        {/* Master Switch */}
        <div className="flex items-center gap-2.5 bg-slate-950/80 px-3 py-2 rounded-xl border border-white/10 shadow-md shrink-0">
          <span className={`text-[11px] font-bold ${settings.enabled ? 'text-emerald-400' : 'text-slate-400'}`}>
            {settings.enabled ? 'فعال روی سایت‌ها' : 'غیرفعال'}
          </span>
          <button
            type="button"
            onClick={() => handleSave({ ...settings, enabled: !settings.enabled })}
            className={`w-12 h-7 flex items-center rounded-full p-1 transition-all cursor-pointer ${
              settings.enabled ? 'bg-emerald-500 justify-start' : 'bg-slate-700 justify-end'
            }`}
            title={settings.enabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center">
              <Power className={`w-3 h-3 ${settings.enabled ? 'text-emerald-600 font-bold' : 'text-slate-600'}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Scope Mode Switcher Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-950/80 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => setEditScope('global')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              editScope === 'global'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>پیش‌فرض عمومی (همه سایت‌ها)</span>
          </button>
          <button
            type="button"
            onClick={() => setEditScope('domain')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              editScope === 'domain'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>تنظیمات اختصاصی ({currentDomain})</span>
            {hasDomainOverride && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="دارای تنظیمات اختصاصی" />
            )}
          </button>
        </div>

        {editScope === 'domain' ? (
          <div className="flex items-center gap-2 px-2 text-xs w-full sm:w-auto justify-end">
            {hasDomainOverride ? (
              <button
                type="button"
                onClick={handleRemoveDomainOverride}
                className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg border border-rose-500/30 transition-all font-bold flex items-center gap-1.5 cursor-pointer text-[11px]"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>حذف اختصاصی‌ها و بازگشت به عمومی</span>
              </button>
            ) : (
              <span className="text-slate-400 text-[11px]">این سایت اکنون از تنظیمات پیش‌فرض استفاده می‌کند.</span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-[11px] px-2">تغییرات این بخش روی تمامی سایت‌ها اعمال می‌شود.</span>
        )}
      </div>

      {/* Main Configuration Grid - Compact */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${settings.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        
        {/* Box 1: Font Selection & Whitelist/Blacklist Scope */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">انتخاب فونت و دامنه اعمال</h3>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('fontEnabled', displayFontEnabled === false ? true : false)}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-all cursor-pointer shrink-0 ${
                  displayFontEnabled !== false ? 'bg-cyan-500 justify-start' : 'bg-slate-700 justify-end'
                }`}
                title="تغییر وضعیت اعمال فونت"
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center">
                  <Check className={`w-3 h-3 ${displayFontEnabled !== false ? 'text-cyan-600 font-bold' : 'text-slate-600'}`} />
                </div>
              </button>
            </div>

            <div className={`space-y-4 transition-all duration-300 ${displayFontEnabled !== false ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {/* Font Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  {isDomainMode ? `فونت فارسی در ${currentDomain}:` : 'فونت پیش‌فرض وب‌سایت‌ها:'}
                </label>
                <select
                  value={displayFontId}
                  onChange={(e) => updateSetting('selectedFontId', e.target.value)}
                  className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500/60 cursor-pointer shadow-inner"
                >
                  {allFonts.map((f) => (
                    <option key={f.id} value={f.id} className="bg-slate-900 text-slate-100 py-1" style={{ fontFamily: f.fontFamily }}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Weight & Line Height Customization Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                {/* Font Weight */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300">ضخامت فونت (Weight):</label>
                  <select
                    value={displayFontWeight}
                    onChange={(e) => updateSetting('fontWeight', e.target.value)}
                    className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500/60 cursor-pointer"
                  >
                    <option value="default">پیش‌فرض سایت</option>
                    <option value="300">نازک (300 - Light)</option>
                    <option value="400">معمولی (400 - Regular)</option>
                    <option value="500">متوسط (500 - Medium)</option>
                    <option value="600">نیمه‌ضخیم (600 - SemiBold)</option>
                    <option value="700">ضخیم (700 - Bold)</option>
                    <option value="800">بسیار ضخیم (800 - ExtraBold)</option>
                    <option value="900">سنگین (900 - Black)</option>
                  </select>
                </div>

                {/* Line Height */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300">فاصله خطوط (Line Height):</label>
                  <select
                    value={displayLineHeight}
                    onChange={(e) => updateSetting('lineHeight', e.target.value)}
                    className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-cyan-500/60 cursor-pointer"
                  >
                    <option value="default">پیش‌فرض سایت</option>
                    <option value="1.4">فشرده (1.4)</option>
                    <option value="1.6">استاندارد (1.6)</option>
                    <option value="1.8">باز و راحت (1.8)</option>
                    <option value="2.0">خیلی باز (2.0)</option>
                    <option value="2.2">حداکثر (2.2)</option>
                  </select>
                </div>
              </div>

              {/* Font Size Scale & Text-Only Size - Sliders */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-200 flex items-center gap-1" title="افزایش هم‌زمان سایز متن و ابعاد چیدمان صفحه (باکس‌ها و فاصله‌ها)">
                      <span>🌐 بزرگ‌نمایی کلی صفحه (Page Scale):</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(displayFontSizeScale !== 100) && (
                        <button
                          type="button"
                          onClick={() => updateSetting('fontSizeScale', 100)}
                          className="text-[10px] bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 px-1.5 py-0.5 rounded transition-all font-bold"
                          title="بازگشت به سایز پیش‌فرض ۱۰۰٪"
                        >
                          ۱۰۰٪
                        </button>
                      )}
                      <span className="font-mono text-cyan-400 font-bold text-xs">{displayFontSizeScale}%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="150"
                    step="5"
                    value={displayFontSizeScale}
                    onChange={(e) => updateSetting('fontSizeScale', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-purple-200 flex items-center gap-1" title="فقط حروف و متن‌ها بزرگتر می‌شوند، بدون اینکه چیدمان و دکمه‌های صفحه اسکیل شود">
                      <span>📝 افزایش خالص سایز متن‌ها (Text Only):</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(displayTextFontSizeScale !== 100) && (
                        <button
                          type="button"
                          onClick={() => updateSetting('textFontSizeScale', 100)}
                          className="text-[10px] bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 px-1.5 py-0.5 rounded transition-all font-bold"
                          title="بازگشت به سایز پیش‌فرض ۱۰۰٪"
                        >
                          ۱۰۰٪
                        </button>
                      )}
                      <span className="font-mono text-purple-400 font-bold text-xs">{displayTextFontSizeScale}%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="150"
                    step="5"
                    value={displayTextFontSizeScale}
                    onChange={(e) => updateSetting('textFontSizeScale', Number(e.target.value))}
                    className="w-full accent-purple-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>

              {/* Scope Selector (Only visible in Global Mode) */}
              {!isDomainMode && (
                <div className="space-y-2 pt-1 border-t border-white/10">
                  <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-cyan-400" />
                    <span>حالت اعمال (وایت‌لیست / بلک‌لیست):</span>
                  </label>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSave({ ...settings, applyScope: 'all_sites' })}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center cursor-pointer ${
                      settings.applyScope === 'all_sites' || !settings.applyScope
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 font-bold shadow-md'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>همه سایت‌ها</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave({ ...settings, applyScope: 'current_site' })}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center cursor-pointer ${
                      settings.applyScope === 'current_site'
                        ? 'bg-purple-500/20 text-purple-200 border-purple-500/50 font-bold shadow-md'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5 text-purple-400" />
                    <span>فقط سایت جاری</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave({ ...settings, applyScope: 'whitelist' })}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center cursor-pointer ${
                      settings.applyScope === 'whitelist'
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 font-bold shadow-md'
                        : 'bg-slate-950/60 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>فقط لیست سفید</span>
                  </button>
                </div>

                {/* Current Site Domain Input */}
                {settings.applyScope === 'current_site' && (
                  <div className="pt-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={settings.currentSiteDomain}
                        onChange={(e) => handleSave({ ...settings, currentSiteDomain: e.target.value.toLowerCase().trim() })}
                        placeholder="example.com"
                        className="flex-1 bg-slate-950/90 border border-purple-500/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none font-mono dir-ltr text-left"
                      />
                      <span className="px-2.5 py-1.5 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30 text-[10px] font-semibold">
                        هدف
                      </span>
                    </div>
                  </div>
                )}

                {/* Blacklist Mode UI (When in All Sites) */}
                {(settings.applyScope === 'all_sites' || !settings.applyScope) && (
                  <div className="pt-2 space-y-2 animate-fadeIn bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                      <span>🚫 لیست سیاه (عدم اعمال روی این سایت‌ها):</span>
                      {settings.currentSiteDomain && !(settings.excludedDomains || []).includes(settings.currentSiteDomain) && (
                        <button
                          type="button"
                          onClick={() => addDomain('exclude', settings.currentSiteDomain)}
                          className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md hover:bg-rose-500/30"
                        >
                          + استثنای سایت جاری ({settings.currentSiteDomain})
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newDomainInput}
                        onChange={(e) => setNewDomainInput(e.target.value)}
                        placeholder="دامنه جدید (مثلا: youtube.com)"
                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none font-mono dir-ltr text-left"
                      />
                      <button
                        type="button"
                        onClick={() => addDomain('exclude')}
                        className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs hover:bg-rose-500/30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {(settings.excludedDomains && settings.excludedDomains.length > 0) && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1">
                        {settings.excludedDomains.map((d, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/15 text-rose-300 border border-rose-500/25 rounded-md text-[10px] font-mono dir-ltr">
                            <span>{d}</span>
                            <button type="button" onClick={() => removeDomain('exclude', d)} className="text-rose-400 hover:text-white font-bold ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Whitelist Mode UI */}
                {settings.applyScope === 'whitelist' && (
                  <div className="pt-2 space-y-2 animate-fadeIn bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                      <span>✅ لیست سفید (اعمال فقط روی این سایت‌ها):</span>
                      {settings.currentSiteDomain && !(settings.includedDomains || []).includes(settings.currentSiteDomain) && (
                        <button
                          type="button"
                          onClick={() => addDomain('include', settings.currentSiteDomain)}
                          className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md hover:bg-emerald-500/30"
                        >
                          + افزودن سایت جاری ({settings.currentSiteDomain})
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newDomainInput}
                        onChange={(e) => setNewDomainInput(e.target.value)}
                        placeholder="دامنه مجاز (مثلا: chatgpt.com)"
                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none font-mono dir-ltr text-left"
                      />
                      <button
                        type="button"
                        onClick={() => addDomain('include')}
                        className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs hover:bg-emerald-500/30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {(settings.includedDomains && settings.includedDomains.length > 0) && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1">
                        {settings.includedDomains.map((d, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-md text-[10px] font-mono dir-ltr">
                            <span>{d}</span>
                            <button type="button" onClick={() => removeDomain('include', d)} className="text-emerald-400 hover:text-white font-bold ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </div>
              )}
            </div>
          </div>

          {/* Live Font Preview Box (Hidden in Popup Mode to keep UI compact) */}
          {!isPopup && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 mt-3">
              <div className="text-[10px] text-slate-500 flex justify-between items-center mb-1">
                <span>پیش‌نمایش فونت:</span>
                <span className="font-mono text-cyan-400">{selectedFontObj?.name}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-normal" style={{ fontFamily: selectedFontObj?.fontFamily }}>
                هوش مصنوعی کروم؛ همراه هوشمند شما در وب فارسی.
              </p>
            </div>
          )}
        </div>

        {/* Box 2: RTL & Layout Customization */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <AlignRight className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">قابلیت راست‌چین کردن (RTL)</h3>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('rtlEnabled', displayRtlEnabled === false ? true : false)}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-all cursor-pointer shrink-0 ${
                  displayRtlEnabled !== false ? 'bg-purple-500 justify-start' : 'bg-slate-700 justify-end'
                }`}
                title="تغییر وضعیت راست‌چین"
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center">
                  <Check className={`w-3 h-3 ${displayRtlEnabled !== false ? 'text-purple-600 font-bold' : 'text-slate-600'}`} />
                </div>
              </button>
            </div>

            <div className={`space-y-2.5 transition-all duration-300 ${displayRtlEnabled !== false ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {/* RTL Mode Options - Compact */}
              <div
                onClick={() => updateSetting('rtlMode', 'none')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                  displayRtlMode === 'none'
                    ? 'bg-slate-800/80 border-slate-500 text-white shadow'
                    : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  displayRtlMode === 'none' ? 'border-cyan-400 bg-cyan-400 text-slate-950 font-bold' : 'border-slate-600'
                }`}>
                  {displayRtlMode === 'none' && <Check className="w-2.5 h-2.5" />}
                </div>
                <span className="text-xs font-bold text-slate-200">بدون تغییر جهت (حالت پیش‌فرض سایت)</span>
              </div>

              <div
                onClick={() => updateSetting('rtlMode', 'content_only')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 relative overflow-hidden ${
                  displayRtlMode === 'content_only'
                    ? 'bg-purple-500/20 border-purple-500/60 text-white shadow'
                    : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="absolute top-0 left-0 bg-purple-500 text-white text-[8px] px-1.5 py-0.2 rounded-br font-bold">
                  توصیه شده
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  displayRtlMode === 'content_only' ? 'border-purple-400 bg-purple-400 text-slate-950 font-bold' : 'border-slate-600'
                }`}>
                  {displayRtlMode === 'content_only' && <Check className="w-2.5 h-2.5" />}
                </div>
                <span className="text-xs font-bold text-purple-200">راست‌چین هوشمند (فقط متن و گفتگوها)</span>
              </div>

              <div
                onClick={() => updateSetting('rtlMode', 'full_site')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                  displayRtlMode === 'full_site'
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-white shadow'
                    : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  displayRtlMode === 'full_site' ? 'border-cyan-400 bg-cyan-400 text-slate-950 font-bold' : 'border-slate-600'
                }`}>
                  {displayRtlMode === 'full_site' && <Check className="w-2.5 h-2.5" />}
                </div>
                <span className="text-xs font-bold text-cyan-200">راست‌چین کامل کل وب‌سایت (Full RTL)</span>
              </div>

              {/* Custom Element Selector Mode */}
              <div
                onClick={() => updateSetting('rtlMode', 'custom_selector')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                  displayRtlMode === 'custom_selector'
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-white shadow'
                    : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  displayRtlMode === 'custom_selector' ? 'border-emerald-400 bg-emerald-400 text-slate-950 font-bold' : 'border-slate-600'
                }`}>
                  {displayRtlMode === 'custom_selector' && <Check className="w-2.5 h-2.5" />}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">🎯 انتخاب بخش دلخواه با موس (Selector)</span>
                </div>
              </div>

              {/* Custom Selector Picker Action Box */}
              {displayRtlMode === 'custom_selector' && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-emerald-500/30 space-y-2.5 animate-fadeIn">
                  <button
                    type="button"
                    onClick={startElementPicker}
                    className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                    <span>انتخاب بخش در سایت جاری با موس</span>
                  </button>

                  {/* Saved Selectors for Current Domain */}
                  {currentDomainSelectors.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-white/10">
                      <div className="text-[10px] text-slate-400 flex justify-between items-center">
                        <span>بخش‌های ذخیره‌شده ({currentDomain}):</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isDomainMode) {
                              const currentOverrides = { ...(settings.domainOverrides || {}) };
                              const hostOverride = { ...(currentOverrides[currentDomain] || {}) };
                              delete hostOverride.customRtlSelectors;
                              handleSave({
                                ...settings,
                                domainOverrides: { ...currentOverrides, [currentDomain]: hostOverride },
                              });
                            } else {
                              const customMap = { ...(settings.customRtlSelectors || {}) };
                              delete customMap[currentDomain];
                              handleSave({ ...settings, customRtlSelectors: customMap });
                            }
                          }}
                          className="text-rose-400 hover:text-rose-300 text-[10px] underline"
                        >
                          حذف همه
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {currentDomainSelectors.map((sel, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-mono dir-ltr">
                            <span className="max-w-[150px] truncate">{sel}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const list = currentDomainSelectors.filter((_, i) => i !== idx);
                                if (isDomainMode) {
                                  const currentOverrides = { ...(settings.domainOverrides || {}) };
                                  const hostOverride = { ...(currentOverrides[currentDomain] || {}) };
                                  if (list.length === 0) delete hostOverride.customRtlSelectors;
                                  else hostOverride.customRtlSelectors = list;
                                  handleSave({
                                    ...settings,
                                    domainOverrides: { ...currentOverrides, [currentDomain]: hostOverride },
                                  });
                                } else {
                                  const customMap = { ...(settings.customRtlSelectors || {}) };
                                  if (list.length === 0) delete customMap[currentDomain];
                                  else customMap[currentDomain] = list;
                                  handleSave({ ...settings, customRtlSelectors: customMap });
                                }
                              }}
                              className="text-emerald-400 hover:text-rose-400 font-bold ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Inputs & Editable Areas RTL Toggle Box */}
              <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 space-y-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>⌨️ راست‌چین شدن باکس‌های تایپ و چت:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateSetting('inputsRtl', !displayInputsRtl)}
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-all cursor-pointer shrink-0 ${
                      displayInputsRtl ? 'bg-cyan-500 justify-start' : 'bg-slate-700 justify-end'
                    }`}
                    title="راست‌چین شدن باکس‌های ورودی متن"
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center">
                      <Check className={`w-3 h-3 ${displayInputsRtl ? 'text-cyan-600 font-bold' : 'text-slate-600'}`} />
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  راست‌چین شدن کادر تایپ (تکست‌باکس‌ها و چت) بدون به هم ریختن چیدمان دکمه‌ها یا قاطی شدن متن انگلیسی با استفاده از الگوریتم هوشمند bidi.
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Footer Info & Save feedback */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/5 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>ذخیره خودکار و اعمال آنی روی تمامی صفحات وب</span>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/40 font-bold animate-fadeIn shrink-0">
            <Check className="w-3.5 h-3.5" />
            <span>ذخیره شد</span>
          </div>
        )}
      </div>
    </div>
  );
};
