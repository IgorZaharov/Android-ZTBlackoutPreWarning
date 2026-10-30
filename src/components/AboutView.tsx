import React from 'react';
import { 
  Github, 
  ExternalLink, 
  Bug, 
  Smartphone, 
  Monitor, 
  ShieldAlert, 
  Zap
} from 'lucide-react';
import { translations } from '../services/i18n';

interface AboutViewProps {
  lang: 'uk' | 'en';
}

export const AboutView: React.FC<AboutViewProps> = ({ lang }) => {
  const t = translations[lang];

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto select-none">
      {/* App Identity Banner */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-6 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FF5E3A] flex items-center justify-center text-white shadow-lg mb-3 shadow-[#FF5E3A]/30">
          <Zap className="w-8 h-8 fill-current" />
        </div>

        <h1 className="text-xl font-bold text-white tracking-tight">
          {t.appTitle}
        </h1>
        <p className="text-xs text-sky-200/70 mt-1 max-w-xs">
          {t.appSubtitle}
        </p>

        <div className="flex items-center gap-2 mt-3 text-[11px] font-mono">
          <span className="px-3 py-1 rounded-full bg-white/10 text-sky-100 font-semibold border border-white/15">
            v1.0.0
          </span>
          <span className="px-3 py-1 rounded-full bg-[#FF5E3A]/20 text-[#FF5E3A] font-semibold border border-[#FF5E3A]/30">
            Jetpack Compose M3
          </span>
        </div>
      </div>

      {/* Description Card */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-200/70">
          {lang === 'uk' ? 'Опис застосунку' : 'App Description'}
        </h2>
        <p className="text-xs leading-relaxed text-zinc-200">
          {t.aboutDesc}
        </p>
        <p className="text-xs leading-relaxed text-sky-200/80 bg-white/[0.06] p-3 rounded-2xl border border-white/10">
          {t.aboutDesktopNotice}
        </p>
      </div>

      {/* Developer & GitHub Links */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-sky-200/70">
          {t.aboutLinks}
        </h2>

        {/* 1. Main GitHub Profile */}
        <a
          href="https://github.com/IgorZaharov"
          target="_blank"
          rel="noopener noreferrer"
          title="https://github.com/IgorZaharov"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all group overflow-hidden"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
            <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center shrink-0 shadow-sm">
              <Github className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white group-hover:text-[#FF5E3A] transition-colors truncate">
                {t.aboutGithubProfile}
              </div>
              <div className="text-[11px] text-sky-200/70 font-mono truncate">
                github.com/IgorZaharov
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-sky-200/70 group-hover:text-white transition-colors shrink-0" />
        </a>

        {/* 2. Project Issues & Requests */}
        <a
          href="https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues"
          target="_blank"
          rel="noopener noreferrer"
          title="https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all group overflow-hidden"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
            <div className="w-10 h-10 rounded-2xl bg-[#FF5E3A] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#FF5E3A]/30">
              <Bug className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white group-hover:text-[#FF5E3A] transition-colors truncate">
                {t.aboutRepoIssues}
              </div>
              <div className="text-[11px] text-sky-200/70 font-mono truncate">
                github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-sky-200/70 group-hover:text-white transition-colors shrink-0" />
        </a>

        {/* 3. Original Windows Desktop App */}
        <a
          href="https://github.com/IgorZaharov/UABlackoutPreWarning"
          target="_blank"
          rel="noopener noreferrer"
          title="https://github.com/IgorZaharov/UABlackoutPreWarning"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all group overflow-hidden"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white group-hover:text-[#FF5E3A] transition-colors truncate">
                {t.aboutDesktopRepo}
              </div>
              <div className="text-[11px] text-sky-200/70 font-mono truncate">
                github.com/IgorZaharov/UABlackoutPreWarning
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-sky-200/70 group-hover:text-white transition-colors shrink-0" />
        </a>
      </div>

      {/* Google Play Console Status Card */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-white truncate">
            Google Play Store Ready
          </div>
          <div className="text-[11px] text-sky-200/80 leading-relaxed">
            {lang === 'uk' 
              ? 'Готовий до складання AAB бандлу через GitHub Actions CI.' 
              : 'Ready to build signed AAB bundle via GitHub Actions CI.'}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/25">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-sky-200/80">
          {t.aboutDisclaimer}
        </div>
      </div>
    </div>
  );
};
