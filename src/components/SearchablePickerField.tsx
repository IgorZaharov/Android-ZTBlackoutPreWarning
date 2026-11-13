/**
 * A read-only field that opens a full-screen searchable list, mirrored from
 * android/.../ui/components/SearchablePickerField.kt. Built for the address lookup where one list can
 * hold 966 streets: rows are windowed (only the visible ones are in the DOM) and keyed by id, search is
 * the pure PickerSearch port (apostrophe, diacritic, case and street-type-prefix insensitive).
 *
 * States: loading (spinner; a thin bar when rows are already shown), loadFailed (message with Retry when
 * onRetry is set) and an empty result ("Нічого не знайдено").
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { translations } from '../services/i18n';
import { PickerIndex, type SearchKind } from './pickerSearch';
import { ModalPortal } from './ModalPortal';

export interface PickerItem {
  id: string;
  label: string;
}

interface SearchablePickerFieldProps {
  label: string;
  value?: string | null;
  placeholder: string;
  items: readonly PickerItem[];
  selectedId?: string | null;
  onSelect: (item: PickerItem) => void;
  lang: 'uk' | 'en';
  enabled?: boolean;
  loading?: boolean;
  loadFailed?: boolean;
  onRetry?: () => void;
  kind?: SearchKind;
  disabledHint?: string;
  testId?: string;
}

const ROW_HEIGHT = 52;
const OVERSCAN = 8;

export const SearchablePickerField: React.FC<SearchablePickerFieldProps> = ({
  label,
  value,
  placeholder,
  items,
  selectedId,
  onSelect,
  lang,
  enabled = true,
  loading = false,
  loadFailed = false,
  onRetry,
  kind = 'TEXT',
  disabledHint,
  testId,
}) => {
  const t = translations[lang];
  const [open, setOpen] = useState(false);
  const shownText = value && value.trim() !== '' ? value : placeholder;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    // give the focus back to the field that opened the picker
    setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold leading-5 text-[#BAE6FD]/90">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        disabled={!enabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}, ${shownText}${!enabled && disabledHint ? `, ${disabledHint}` : ''}`}
        onClick={() => setOpen(true)}
        className={`flex min-h-14 w-full cursor-pointer items-center gap-2 rounded-2xl border py-2 pr-2 pl-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#FF5E3A] ${
          enabled ? 'border-white/20 bg-white/[0.08] hover:bg-white/[0.12]' : 'cursor-not-allowed border-white/10 bg-white/5'
        }`}
      >
        <span
          className={`line-clamp-2 flex-1 text-base font-medium leading-6 ${
            !enabled ? 'text-white/50' : !value || value.trim() === '' ? 'text-[#BAE6FD]/60' : 'text-white'
          }`}
        >
          {shownText}
        </span>
        {loading && <Loader2 className="mx-2 h-[18px] w-[18px] animate-spin text-[#FF5E3A]" aria-hidden="true" />}
        <ChevronDown className={`h-6 w-6 shrink-0 ${enabled ? 'text-white/70' : 'text-white/30'}`} aria-hidden="true" />
      </button>

      {open && (
        <ModalPortal>
        <PickerDialog
          title={label}
          items={items}
          selectedId={selectedId ?? null}
          lang={lang}
          loading={loading}
          loadFailed={loadFailed}
          onRetry={onRetry}
          kind={kind}
          onDismiss={close}
          onSelect={(item) => {
            close();
            onSelect(item);
          }}
        />
        </ModalPortal>
      )}
    </div>
  );
};

interface PickerDialogProps {
  title: string;
  items: readonly PickerItem[];
  selectedId: string | null;
  lang: 'uk' | 'en';
  loading: boolean;
  loadFailed: boolean;
  onRetry?: () => void;
  kind: SearchKind;
  onDismiss: () => void;
  onSelect: (item: PickerItem) => void;
}

const PickerDialog: React.FC<PickerDialogProps> = ({ title, items, selectedId, lang, loading, loadFailed, onRetry, kind, onDismiss, onSelect }) => {
  const t = translations[lang];
  // duplicate ids would break keyed rendering, so the list is made unique once
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  }, [items]);
  const index = useMemo(() => new PickerIndex(unique, kind, (it) => it.label), [unique, kind]);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => index.search(query), [index, query]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(480);
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Open scrolled to the selected row
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setViewport(el.clientHeight || 480);
    const initial = Math.max(0, unique.findIndex((it) => it.id === selectedId));
    el.scrollTop = Math.max(0, initial * ROW_HEIGHT - ROW_HEIGHT);
    setScrollTop(el.scrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight || 480));
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown.length === 0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDismiss]);

  // A new query starts at the top
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
    setScrollTop(0);
    setActiveIdx(-1);
  }, [query]);

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(shown.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN);

  const moveActive = (next: number) => {
    const clamped = Math.max(0, Math.min(shown.length - 1, next));
    setActiveIdx(clamped);
    const el = listRef.current;
    if (el) {
      const top = clamped * ROW_HEIGHT;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(activeIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(activeIdx - 1);
    } else if (e.key === 'Enter' && activeIdx >= 0 && shown[activeIdx]) {
      e.preventDefault();
      onSelect(shown[activeIdx]);
    }
  };

  const isEmptyList = unique.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="picker-dialog"
      className="fixed inset-0 z-[70] flex flex-col bg-[#141A29] text-white"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 pt-12 pr-4 pl-1">
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.pickerClose}
          data-testid="picker-close"
          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-6 w-6" aria-hidden="true" />
        </button>
        <h3 className="line-clamp-2 flex-1 pl-1 text-xl font-extrabold leading-7 text-white">{title}</h3>
      </div>

      <div className="relative px-4 py-2">
        <Search className="pointer-events-none absolute top-1/2 left-7 h-5 w-5 -translate-y-1/2 text-white/70" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          data-testid="picker-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t.pickerSearchHint}
          aria-label={`${t.pickerSearchHint}: ${title}`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-14 w-full rounded-2xl border border-white/20 bg-white/10 py-2 pr-14 pl-12 text-base font-medium text-white placeholder:text-[#BAE6FD]/60 focus:border-[#FF5E3A] focus:outline-none"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label={t.pickerClearSearch}
            className="absolute top-1/2 right-5 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {loading && shown.length > 0 && (
        <div className="mx-4 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={t.pickerLoading}>
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#FF5E3A] motion-reduce:animate-none" />
        </div>
      )}
      {loadFailed && !isEmptyList && (
        <div className="flex items-center gap-2 px-4 py-1">
          <AlertCircle className="h-5 w-5 shrink-0 text-[#F87171]" aria-hidden="true" />
          <span className="flex-1 text-[13px] font-medium leading-[19px] text-[#F87171]">{t.pickerLoadError}</span>
          {onRetry && <RetryButton label={t.pickerRetry} onRetry={onRetry} />}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {shown.length > 0 ? (
          <div
            ref={listRef}
            role="listbox"
            aria-label={title}
            aria-activedescendant={activeIdx >= 0 && shown[activeIdx] ? `picker-opt-${shown[activeIdx].id}` : undefined}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
            className="absolute inset-0 overflow-y-auto overscroll-contain pb-4"
            data-testid="picker-list"
          >
            <div className="relative" style={{ height: shown.length * ROW_HEIGHT }}>
              {shown.slice(first, last).map((item, k) => {
                const i = first + k;
                const selected = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    id={`picker-opt-${item.id}`}
                    role="option"
                    aria-selected={selected}
                    aria-setsize={shown.length}
                    aria-posinset={i + 1}
                    tabIndex={-1}
                    onClick={() => onSelect(item)}
                    className={`absolute right-0 left-0 flex cursor-pointer items-center px-4 text-base font-medium leading-6 hover:bg-white/10 ${
                      selected ? 'bg-white/[0.08]' : ''
                    } ${i === activeIdx ? 'outline-2 -outline-offset-2 outline-[#FF5E3A]' : ''}`}
                    style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                  >
                    <span className="line-clamp-2 flex-1 pr-3">{item.label}</span>
                    {selected && (
                      <>
                        <Check className="h-6 w-6 shrink-0 text-[#FF5E3A]" aria-hidden="true" />
                        <span className="sr-only">{t.pickerSelected}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : loading ? (
          <Centered>
            <Loader2 className="h-8 w-8 animate-spin text-[#FF5E3A]" aria-hidden="true" />
            <span className="text-base font-medium leading-6 text-[#BAE6FD]/90" role="status">
              {t.pickerLoading}
            </span>
          </Centered>
        ) : loadFailed && isEmptyList ? (
          <Centered>
            <AlertCircle className="h-8 w-8 text-[#F87171]" aria-hidden="true" />
            <span className="text-center text-base font-medium leading-6 text-white" role="alert">
              {t.pickerLoadError}
            </span>
            {onRetry && <RetryButton label={t.pickerRetry} onRetry={onRetry} />}
          </Centered>
        ) : (
          <Centered>
            <span className="text-center text-base font-medium leading-6 text-[#BAE6FD]/90" role="status">
              {t.pickerNothingFound}
            </span>
            {isEmptyList && onRetry && <RetryButton label={t.pickerRetry} onRetry={onRetry} />}
          </Centered>
        )}
      </div>
    </div>
  );
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 p-6">{children}</div>
);

const RetryButton: React.FC<{ label: string; onRetry: () => void }> = ({ label, onRetry }) => (
  <button
    type="button"
    onClick={onRetry}
    data-testid="picker-retry"
    className="min-h-12 cursor-pointer rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
  >
    {label}
  </button>
);
