import React, { useState } from 'react';
import {
  Download,
  Layers,
  PanelRight,
  Sparkles,
  Youtube,
  Settings,
  MessageSquare,
  Menu,
  X,
  Bot,
  Type,
  Globe,
  List,
  Sun,
  Moon,
  Flame,
  Layout,
} from 'lucide-react';
import { AIProvider, UILanguage, AppTheme } from '../types';
import { getTranslation } from '../services/i18n';

export type TabType = 'chat' | 'providers' | 'youtube' | 'subtitles' | 'logs' | 'webcustomizer';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isSidePanelOpen: boolean;
  setIsSidePanelOpen: (open: boolean) => void;
  providers: AIProvider[];
  activeProviderId: string;
  activeModelId: string;
  onDownloadZip: () => void;
  uiLanguage: UILanguage;
  setUiLanguage: (lang: UILanguage) => void;
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;
  isPopup?: boolean;
  onOpenSidePanel?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isSidePanelOpen,
  setIsSidePanelOpen,
  providers,
  activeProviderId,
  activeModelId,
  onDownloadZip,
  uiLanguage,
  setUiLanguage,
  appTheme,
  setAppTheme,
  isPopup,
  onOpenSidePanel,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const t = getTranslation(uiLanguage);

  interface NavItem {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    badge?: string;
  }

  const navItems: NavItem[] = [
    {
      id: 'chat' as TabType,
      label: t.tabChat,
      icon: MessageSquare,
      color: 'text-cyan-400',
    },
    {
      id: 'subtitles' as TabType,
      label: t.tabSubtitles,
      icon: Type,
      color: 'text-cyan-400',
    },
    {
      id: 'logs' as TabType,
      label: t.tabLogs,
      icon: List,
      color: 'text-blue-400',
    },
    {
      id: 'providers' as TabType,
      label: 'تنظیمات',
      icon: Settings,
      color: 'text-amber-400',
    },
  ];

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 px-2 py-2 sm:px-4 sm:py-3 select-none">
      <div className="bg-slate-950/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40">
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-cyan-500/20 blur-[60px] rounded-full"></div>
          <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full"></div>
        </div>

        <div className="relative flex flex-col gap-2 p-2 sm:p-3">
          {/* Top Row: Logo & Theme */}
          <div className="flex items-center justify-between">
            {/* Logo & Branding */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="relative group cursor-pointer">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-xl blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 border border-white/10 rounded-xl shadow-inner">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-xs sm:text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight flex items-center gap-1 sm:gap-2">
                  <span>Chrome AI Companion</span>
                  <span className="px-1.5 py-0.5 text-[8px] sm:text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-md">
                    Manifest V3
                  </span>
                </h1>
                <p className="text-[9px] sm:text-[11px] text-slate-400 font-medium">
                  افزونه هوشمند چت و زیرنویس یوتیوب
                </p>
              </div>
            </div>

            {/* Right Action Tools */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Active Model Indicator Badge (Desktop only) */}
              {activeProvider && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 backdrop-blur-md rounded-xl border border-white/10 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-slate-300 font-medium">{activeProvider.name}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-cyan-400 font-mono text-[11px] truncate max-w-[120px]">
                    {activeModelId.split('/').pop()}
                  </span>
                </div>
              )}

              {/* Open Side Panel Button (in Popup Mode) */}
              {isPopup && onOpenSidePanel && (
                <button
                  onClick={onOpenSidePanel}
                  className="px-3 py-1.5 h-8 sm:h-9 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-950/40 cursor-pointer shrink-0"
                  title="باز کردن پنل سمت راست مرورگر (Side Panel)"
                >
                  <Layout className="w-4 h-4" />
                  <span>باز کردن پنل کناری</span>
                </button>
              )}

              {/* Theme Switcher Toggle (Single Icon Button) */}
              <button
                onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all shadow-md cursor-pointer shrink-0"
                title={appTheme === 'dark' ? 'تغییر به تم روشن (Light Mode)' : 'تغییر به تم تاریک (Dark Mode)'}
              >
                {appTheme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />}
              </button>
            </div>
          </div>

          {/* Bottom Row: Scrollable Navigation Tabs (Hidden in Popup Mode) */}
          {!isPopup && (
            <nav className="flex items-center gap-1.5 bg-slate-900/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar w-full">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/40 backdrop-blur-md font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-[10px] bg-cyan-500/30 text-cyan-200 rounded-md border border-cyan-400/30 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};
