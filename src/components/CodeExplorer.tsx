import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Folder, 
  FileText, 
  ExternalLink
} from 'lucide-react';
import { ANDROID_PROJECT_FILES } from '../data/androidProjectFiles';

export const CodeExplorer: React.FC = () => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentFile = ANDROID_PROJECT_FILES[selectedFileIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 p-2 max-w-4xl mx-auto select-none">
      {/* Header */}
      <div className="bg-[#1C1D24] rounded-3xl p-5 border border-white/5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-[#FF5E3A]" />
            <span>Native Android Code Repository</span>
          </h2>
          <p className="text-xs text-[#8E92A0] mt-0.5">
            Готові вихідні коди Kotlin Jetpack Compose для <code className="font-mono text-[#FF5E3A]">https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning</code>
          </p>
        </div>

        <a
          href="https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-all self-start md:self-auto shadow-md"
        >
          <span>GitHub репозиторій</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Main Split View: File Tree + Code Editor Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#1C1D24] rounded-3xl p-3 border border-white/5 shadow-xl overflow-hidden">
        {/* Left column: File list */}
        <div className="md:col-span-4 flex flex-col gap-1 overflow-y-auto max-h-[520px] p-1 border-b md:border-b-0 md:border-r border-white/5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8E92A0] px-2 py-1 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-[#FF5E3A]" />
            <span>Файли проекту ({ANDROID_PROJECT_FILES.length})</span>
          </div>

          {ANDROID_PROJECT_FILES.map((file, idx) => {
            const isSelected = idx === selectedFileIndex;
            const fileName = file.path.split('/').pop() || file.path;
            const dir = file.path.split('/').slice(0, -1).join('/');

            return (
              <button
                key={file.path}
                onClick={() => setSelectedFileIndex(idx)}
                className={`text-left p-2.5 rounded-xl text-xs transition-all flex flex-col gap-0.5 ${
                  isSelected
                    ? 'bg-white text-black font-bold shadow-md'
                    : 'text-zinc-300 hover:bg-[#252732]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-black' : 'text-[#8E92A0]'}`} />
                  <span className="truncate">{fileName}</span>
                </div>
                {dir && (
                  <span className={`text-[10px] font-mono truncate pl-5 ${isSelected ? 'text-zinc-600' : 'text-[#8E92A0]'}`}>
                    {dir}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column: Code Viewer */}
        <div className="md:col-span-8 flex flex-col min-h-[460px] max-h-[520px] bg-[#121316] rounded-2xl overflow-hidden border border-white/5">
          {/* Viewer Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#17181F] border-b border-white/5">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-xs font-mono font-semibold text-white truncate">
                {currentFile.path}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#24262F] text-[#8E92A0] font-mono">
                {currentFile.language}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-all shadow-md"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Скопійовано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копіювати</span>
                </>
              )}
            </button>
          </div>

          {/* Description sub-bar */}
          <div className="px-4 py-2 bg-[#17181F]/60 border-b border-white/5 text-[11px] text-[#8E92A0] italic">
            {currentFile.description}
          </div>

          {/* Code Body */}
          <div className="flex-1 overflow-auto p-4 text-[12px] font-mono leading-relaxed text-zinc-300">
            <pre className="whitespace-pre">
              <code>{currentFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
