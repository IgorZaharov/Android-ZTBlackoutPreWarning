import React, { useState } from 'react';
import { 
  Key, 
  CheckCircle2, 
  Copy, 
  Check, 
  Smartphone,
  BookOpen
} from 'lucide-react';

export const PlayStoreGuide: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const keytoolCmd = `keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias zt-blackout`;

  return (
    <div className="flex flex-col gap-4 p-2 max-w-2xl mx-auto select-none">
      {/* Header */}
      <div className="bg-[#1C1D24] rounded-3xl p-6 border border-white/5 shadow-xl">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-[#FF5E3A] text-white flex items-center justify-center font-bold shadow-lg shadow-[#FF5E3A]/30">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Google Play Store Publishing Guide
            </h2>
            <p className="text-xs text-[#8E92A0]">
              Покрокова інструкція публікації додатку ZT Blackout Pre-Warning в Google Play
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Keystore */}
      <div className="bg-[#1C1D24] rounded-3xl p-5 border border-white/5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
            1
          </span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Генерація Release Keystore для підпису AAB/APK
          </h3>
        </div>
        <p className="text-xs text-zinc-300">
          Для завантаження в Google Play потрібен цифровий ключ підпису (Android App Bundle). Згенеруйте його за допомогою утиліти keytool:
        </p>
        <div className="relative bg-[#121316] text-zinc-300 p-3.5 rounded-2xl font-mono text-[11px] overflow-x-auto border border-white/5">
          <code>{keytoolCmd}</code>
          <button
            onClick={() => copyToClipboard(keytoolCmd, 'keytool')}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-xl bg-white text-black text-xs flex items-center gap-1 font-bold shadow-md hover:bg-zinc-200 transition-all"
          >
            {copiedKey === 'keytool' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="text-[11px] text-[#FF5E3A] bg-[#FF5E3A]/10 p-3 rounded-2xl border border-[#FF5E3A]/20">
          Завантажте файл <code className="font-mono font-bold">release-key.jks</code> та паролі як GitHub Secrets (<code className="font-mono">SIGNING_KEY_BASE64</code>, <code className="font-mono">KEY_ALIAS</code>, <code className="font-mono">KEY_PASSWORD</code>, <code className="font-mono">STORE_PASSWORD</code>). Наш CI/CD автоматично збере підписаний AAB!
        </div>
      </div>

      {/* Step 2: Google Play Console Account */}
      <div className="bg-[#1C1D24] rounded-3xl p-5 border border-white/5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
            2
          </span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Створення додатку в Google Play Console
          </h3>
        </div>
        <ol className="list-decimal list-inside text-xs text-zinc-300 space-y-2">
          <li>Увійдіть в <a href="https://play.google.com/console" target="_blank" rel="noreferrer" className="text-[#FF5E3A] underline font-semibold">Google Play Console</a>.</li>
          <li>Натисніть кнопку <strong>«Створити додаток» (Create app)</strong>.</li>
          <li>Назва додатку: <code className="font-bold bg-[#24262F] px-2 py-0.5 rounded-lg text-white">ZT Blackout Pre-Warning</code>.</li>
          <li>Мова за замовчуванням: <strong>Українська (uk-UA)</strong>.</li>
          <li>Тип: <strong>Додаток (App)</strong>, Безкоштовний (Free).</li>
        </ol>
      </div>

      {/* Step 3: CI/CD Build & Artifact */}
      <div className="bg-[#1C1D24] rounded-3xl p-5 border border-white/5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
            3
          </span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Автоматична збірка AAB через GitHub Actions
          </h3>
        </div>
        <p className="text-xs text-zinc-300">
          При кожному коміті в репозиторій <code className="font-mono text-[#FF5E3A]">https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning</code> запускається робочий процес <code className="font-mono">.github/workflows/build-apk.yml</code>:
        </p>
        <ul className="text-xs text-zinc-300 space-y-2">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FF5E3A]" />
            <span>Компілює проект на базі JDK 17 та Android SDK 35</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FF5E3A]" />
            <span>Формує бандл <code className="font-mono text-white">app-release.aab</code></span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FF5E3A]" />
            <span>Зберігає артефакт у вкладці <strong>GitHub Actions Artifacts</strong></span>
          </li>
        </ul>
      </div>

      {/* Step 4: Data Safety & Permissions */}
      <div className="bg-[#1C1D24] rounded-3xl p-5 border border-white/5 shadow-xl flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
            4
          </span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Безпека даних (Data Safety)
          </h3>
        </div>
        <div className="bg-[#24262F] p-3.5 rounded-2xl border border-white/5 text-xs space-y-1.5">
          <div className="font-bold text-white">Збір даних: НІ (No data collected).</div>
          <p className="text-[11px] text-[#8E92A0]">Додаток не збирає жодних персональних даних. Усі налаштування зберігаються локально на пристрої.</p>
        </div>
      </div>
    </div>
  );
};
