import React from 'react';
import {
  Layers,
  Cpu,
  Subtitles,
  PanelRight,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  Database
} from 'lucide-react';

export const FeatureRoadmap: React.FC = () => {
  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Engineering Architecture Header */}
      <div className="bg-slate-900/40 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 shadow-2xl space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/20 text-cyan-300 rounded-xl border border-cyan-500/30 backdrop-blur-md">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              معماری نرم‌افزاری و ساختار توسعه ماژولار (Software Engineering Architecture)
            </h2>
            <p className="text-xs text-slate-300">
              طراحی شده بر اساس استانداردهای کروم مانیفست v3 با معماری قابل توسعه جهت افزودن آسان ماژول‌های جدید به مرور زمان.
            </p>
          </div>
        </div>
      </div>

      {/* Architecture Layers Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 space-y-2 shadow-xl">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <span>۱. لایه سرویس هوش مصنوعی (AI Provider Abstraction)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            کلاس یکپارچه و مجرد <code className="text-cyan-300 font-mono">AIService</code> که درخواست‌ها را بین OpenRouter، NVIDIA NIM، Google Gemini و پروکسی اختصاصی مسیریابی و هندل می‌کند.
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 space-y-2 shadow-xl">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
            <PanelRight className="w-4 h-4" />
            <span>۲. پنل راست و ارتباطات (SidePanel & Storage)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            استفاده مستقیم از <code className="text-purple-300 font-mono">chrome.sidePanel</code> و ذخیره‌سازی همگام با <code className="text-purple-300 font-mono">chrome.storage.local</code> جهت ماندگاری کلیدهای API.
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl p-5 rounded-2xl border border-white/10 space-y-2 shadow-xl">
          <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
            <Subtitles className="w-4 h-4" />
            <span>۳. تزریق‌کننده زیرنویس (Content Subtitle Injector)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            اسکریپت تزریقی <code className="text-red-300 font-mono">content.js</code> که المان پلیر یوتیوب را رصد و زیرنویس هوش مصنوعی را به صورت زنده رو ویدیو رندر می‌کند.
          </p>
        </div>
      </div>

      {/* Feature Roadmap Matrix */}
      <div className="bg-slate-900/40 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 space-y-4 shadow-2xl">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <span>جدول زمان‌بندی قابلیت‌ها و فازهای بعدی توسعه</span>
        </h3>

        <div className="space-y-3">
          {/* Phase 1 - Active */}
          <div className="p-4 bg-slate-950/60 backdrop-blur-md rounded-2xl border border-emerald-500/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md font-bold backdrop-blur-md">
                  فاز اول (تکمیل شده)
                </span>
                <h4 className="font-bold text-sm text-white">اتصال به AI + چت SidePanel + زیرنویس یوتیوب</h4>
              </div>
              <p className="text-xs text-slate-300">
                اتصال به OpenRouter، NVIDIA NIM، Gemini، لود هوشمند مدل‌ها با فیلتر free، پنل کشویی چت راست، زیرنویس همزمان یوتیوب.
              </p>
            </div>

            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          </div>

          {/* Phase 2 - Upcoming */}
          <div className="p-4 bg-slate-950/40 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md font-bold backdrop-blur-md">
                  فاز دوم (در حال توسعه)
                </span>
                <h4 className="font-bold text-sm text-slate-200">خلاصه‌ساز هوشمند صفحات و فایل‌های PDF</h4>
              </div>
              <p className="text-xs text-slate-400">
                امکان انتخاب هر متن در هر وب‌سایت، کلیک راست و خلاصه یا ترجمه آنی از طریق منوی Context Menu.
              </p>
            </div>

            <Clock className="w-5 h-5 text-cyan-400 shrink-0" />
          </div>

          {/* Phase 3 - Future */}
          <div className="p-4 bg-slate-950/30 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] bg-slate-800/80 text-slate-400 border border-white/5 rounded-md font-bold">
                  فاز سوم (برنامه‌ریزی شده)
                </span>
                <h4 className="font-bold text-sm text-slate-300">خوانش صوتی (Text-To-Speech) و بانک پرامپت‌ها</h4>
              </div>
              <p className="text-xs text-slate-400">
                تبدیل متن ترجمه شده زیرنویس به صدای صوتی فارسی روان و دسترسی به بانک پرامپت‌های تخصصی برنامه نویسی.
              </p>
            </div>

            <Clock className="w-5 h-5 text-slate-500 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};
