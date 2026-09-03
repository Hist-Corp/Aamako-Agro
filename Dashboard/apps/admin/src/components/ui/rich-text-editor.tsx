'use client';
// ─── Rich Text Editor ─────────────────────────────────────────────────
// Lightweight formatting toolbar (bold/italic/underline/strikethrough,
// font family + size, heading styles, lists, alignment, links and image
// placement) built on document.execCommand over a contentEditable area.
// Font / size / colour controls are editable comboboxes: pick a preset OR
// type a custom font name, any size (`24`, `24px`, `1.5rem`) and any
// colour as hex code or CSS name — then press Enter to apply.
// No external dependencies.

import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';

/** Presets shown in the font dropdown — storefront brand families first. */
const FONT_FAMILIES = [
  'Inter',
  'Playfair Display',
  'JetBrains Mono',
  'Fraunces',
  'Work Sans',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Tahoma',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
];
const FONT_SIZES = [
  { label: 'Extra small (1)', value: '1' },
  { label: 'Small (2)', value: '2' },
  { label: 'Normal (3)', value: '3' },
  { label: 'Medium (4)', value: '4' },
  { label: 'Large (5)', value: '5' },
  { label: 'Huge (6)', value: '6' },
  { label: 'Extra huge (7)', value: '7' },
  { label: '10px', value: '10px' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
  { label: '36px', value: '36px' },
  { label: '40px', value: '40px' },
  { label: '48px', value: '48px' },
  { label: '60px', value: '60px' },
  { label: '72px', value: '72px' },
  { label: '1rem', value: '1rem' },
  { label: '1.25rem', value: '1.25rem' },
  { label: '1.5rem', value: '1.5rem' },
  { label: '2rem', value: '2rem' },
  { label: '2.5rem', value: '2.5rem' },
];
/** Brand palette from the storefront (Frontend/styles.css :root) + basics. */
const TEXT_COLORS: ComboOption[] = [
  { label: 'Ink', value: '#211F17', swatch: '#211F17' },
  { label: 'Ink soft', value: '#55503F', swatch: '#55503F' },
  { label: 'Sage', value: '#5C6B3E', swatch: '#5C6B3E' },
  { label: 'Sage deep', value: '#38401F', swatch: '#38401F' },
  { label: 'Gold', value: '#BE8A2A', swatch: '#BE8A2A' },
  { label: 'Clay', value: '#9C4E30', swatch: '#9C4E30' },
  { label: 'Rust', value: '#7A3820', swatch: '#7A3820' },
  { label: 'Black', value: '#0f172a', swatch: '#0f172a' },
  { label: 'Grey', value: '#64748b', swatch: '#64748b' },
  { label: 'Red', value: '#dc2626', swatch: '#dc2626' },
  { label: 'Orange', value: '#ea580c', swatch: '#ea580c' },
  { label: 'Green', value: '#16a34a', swatch: '#16a34a' },
  { label: 'Blue', value: '#2563eb', swatch: '#2563eb' },
];
const HIGHLIGHTS: ComboOption[] = [
  { label: 'Paper', value: '#F7F1E4', swatch: '#F7F1E4' },
  { label: 'Yellow', value: '#fef08a', swatch: '#fef08a' },
  { label: 'Green', value: '#bbf7d0', swatch: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe', swatch: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8', swatch: '#fbcfe8' },
];
const BLOCKS = [
  { label: 'Paragraph', tag: '<p>' },
  { label: 'Heading 1', tag: '<h1>' },
  { label: 'Heading 2', tag: '<h2>' },
  { label: 'Heading 3', tag: '<h3>' },
];

/** Detect valid CSS colours (hex, rgb()/hsl(), named) for the swatch preview. */
function isValidColor(value: string): boolean {
  if (!value.trim()) return false;
  try {
    return typeof CSS !== 'undefined' && CSS.supports('color', value.trim());
  } catch {
    return false;
  }
}

/** Normalise `rgb(r, g, b)` (what queryCommandValue returns) into `#rrggbb`. */
function rgbToHex(value: string): string {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return value.startsWith('#') ? value : '';
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

interface ComboOption {
  label: string;
  value: string;
  swatch?: string;
}

interface FormatComboProps {
  title: string;
  placeholder: string;
  /** Preset list shown in the dropdown. */
  options: ComboOption[];
  /** Show a live colour swatch of the typed value. */
  color?: boolean;
  width?: string;
  onApply: (value: string) => void;
  /** Called on mousedown so the contenteditable selection is preserved. */
  onCaptureSelection: () => void;
  /** Live value currently active on the selection — shown as the placeholder. */
  current?: string;
}

/**
 * Editable combobox: dropdown of presets + free-text input. Typing a custom
 * font name, size (`16`, `24px`, `1.5rem`) or colour (hex / named) and
 * pressing Enter (or picking a preset) applies it to the selected text.
 */
function FormatCombo({ title, placeholder, options, color, current, width = 'w-24', onApply, onCaptureSelection }: FormatComboProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const apply = (value: string) => {
    if (!value.trim()) {
      setOpen(false);
      return;
    }
    onApply(value.trim());
    setText('');
    setOpen(false);
  };

  const q = text.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    : options;
  const preview = color && isValidColor(text) ? text.trim() : null;

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex items-center"
      onMouseDown={(e) => {
        e.stopPropagation();
        onCaptureSelection();
      }}
    >
      {preview && (
        <span
          className="pointer-events-none absolute left-1 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-sm border border-surface-200"
          style={{ backgroundColor: preview }}
        />
      )}
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply(text);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={current || placeholder}
        title={current ? `${title} — current: ${current}` : title}
        className={`h-7 ${width} rounded-md border border-surface-200 bg-white px-1.5 text-xs text-surface-700 placeholder:text-surface-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 ${preview ? 'pl-6' : ''}`}
      />
      <button
        type="button"
        tabIndex={-1}
        title={`${title} — pick a preset or type your own`}
        className="pointer-events-none absolute right-0.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-surface-400"
        aria-hidden="true"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span className="absolute left-0 top-full z-40 mt-0.5 w-56 overflow-hidden rounded-lg border border-surface-200 bg-white p-1 shadow-lg">
          <span className="flex items-center justify-between border-b border-surface-100 px-2 py-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-surface-400">{title}</span>
            <span className="text-2xs text-surface-300">Enter applies</span>
          </span>
          <span className="block max-h-44 overflow-y-auto">
            {shown.length === 0 && (
              <span className="block px-2 py-1.5 text-xs text-surface-400">
                No preset — press Enter to apply {text.trim() || 'your value'}
              </span>
            )}
            {shown.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-surface-700 hover:bg-surface-100"
              >
                {o.swatch && (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-surface-200" style={{ backgroundColor: o.swatch }} />
                )}
                <span className="min-w-0 truncate">{o.label}</span>
              </button>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}

interface RichTextEditorProps {
  label?: string;
  /** HTML value (controlled). */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  hint?: string;
  /**
   * "block" (default): full toolbar + multi-line editing (long descriptions, bodies).
   * "inline": single-line-ish editing for titles / one-line summaries — keeps
   * character formatting (font, size, color, bold/italic/…) but hides
   * block-level tools (headings, lists, alignment, quotes, images).
   */
  variant?: 'block' | 'inline';
}

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  minHeight,
  hint,
  variant = 'block',
}: RichTextEditorProps) {
  const inline = variant === 'inline';
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [panel, setPanel] = useState<'none' | 'link' | 'image'>('none');
  const [url, setUrl] = useState('');
  // Live formatting state under the caret — surfaced in the Font / Size / Color
  // comboboxes so the user always sees what the selection is currently using.
  const [current, setCurrent] = useState<{ font: string; size: string; color: string }>({
    font: '',
    size: '',
    color: '',
  });

  // Sync external value into the editable area unless the user is editing it.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const push = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  // Track the formatting active on the caret/selection (selectionchange fires
  // on every caret move, click and keystroke). Values are only read while the
  // selection is inside this editor so other fields don't clobber the display.
  useEffect(() => {
    const readCurrent = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !ref.current || !ref.current.contains(sel.anchorNode)) return;
      let font = '';
      let size = '';
      let color = '';
      try {
        font = (document.queryCommandValue('fontName') || '').replace(/^["']|["']$/g, '');
        const rawSize = document.queryCommandValue('fontSize');
        // execCommand sizes are 1-7 — show the px value the browser renders.
        const pxByHtmlSize: Record<string, string> = {
          '1': '8px', '2': '10px', '3': '12px', '4': '14px', '5': '18px', '6': '24px', '7': '32px',
        };
        size = pxByHtmlSize[rawSize] ?? (rawSize && rawSize !== '4' ? rawSize : '');
        color = rgbToHex(document.queryCommandValue('foreColor') || '');
      } catch {
        /* queryCommandValue can throw in rare engines — never break typing */
      }
      setCurrent((prev) =>
        prev.font === font && prev.size === size && prev.color === color ? prev : { font, size, color },
      );
    };
    document.addEventListener('selectionchange', readCurrent);
    return () => document.removeEventListener('selectionchange', readCurrent);
  }, []);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    push();
  };

  const openPanel = (kind: 'link' | 'image') => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
    setUrl('');
    setPanel(panel === kind ? 'none' : kind);
  };

  const insert = (kind: 'link' | 'image') => {
    const clean = url.trim();
    if (!clean) {
      setPanel('none');
      return;
    }
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand(kind === 'link' ? 'createLink' : 'insertImage', false, clean);
    push();
    setUrl('');
    setPanel('none');
  };

  /** Remember the current selection so comboboxes can restore it before applying. */
  const captureSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  /** Restore the captured selection into the editable field. */
  const restoreSelection = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  /** Run an execCommand against the captured selection (for combo "apply"). */
  const execOnSelection = (command: string, arg?: string) => {
    restoreSelection();
    document.execCommand(command, false, arg);
    push();
  };

  /** Apply a font size — HTML sizes 1-7 or any CSS size (`16`, `24px`, `1.5rem`). */
  const applySize = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (/^[1-7]$/.test(trimmed)) {
      execOnSelection('fontSize', trimmed);
      return;
    }
    let size = trimmed;
    // Treat a bare number as pixels.
    if (/^\d+(\.\d+)?$/.test(size)) size = `${size}px`;
    if (!/^\d+(\.\d+)?(px|em|rem|pt|%)$/.test(size)) return;
    // execCommand only understands sizes 1-7, so mark with 7 then replace each
    // generated <font size="7"> with a span carrying the exact CSS font-size.
    restoreSelection();
    document.execCommand('fontSize', false, '7');
    const fonts = ref.current?.querySelectorAll<HTMLElement>('font[size="7"], font[Size="7"]') ?? [];
    fonts.forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = size;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    push();
  };

  const btn =
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-600 hover:bg-surface-100 hover:text-surface-900';
  const divider = <span className="mx-1 h-5 w-px bg-surface-200" aria-hidden="true" />;
  const selectCls =
    'h-7 rounded-md border border-surface-200 bg-white px-1.5 text-xs text-surface-700 focus:outline-none focus:ring-1 focus:ring-brand-500/40';
  const resetThen = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) fn(e.target.value);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-surface-700">{label}</label>}
      <div className="rounded-lg border border-surface-200 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40">
        {/* Formatting toolbar — preventDefault on mousedown keeps the text
            selection intact while clicking toolbar buttons. */}
        <div
          className="flex flex-wrap items-center gap-0.5 border-b border-surface-200 p-1.5"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" title="Bold" className={btn} onClick={() => exec('bold')}><Bold className="h-4 w-4" /></button>
          <button type="button" title="Italic" className={btn} onClick={() => exec('italic')}><Italic className="h-4 w-4" /></button>
          <button type="button" title="Underline" className={btn} onClick={() => exec('underline')}><Underline className="h-4 w-4" /></button>
          <button type="button" title="Strikethrough" className={btn} onClick={() => exec('strikeThrough')}><Strikethrough className="h-4 w-4" /></button>
          {divider}
          <FormatCombo
            title="Font family"
            placeholder="Font"
            width="w-24"
            options={FONT_FAMILIES.map((f) => ({ label: f, value: f }))}
            current={current.font}
            onCaptureSelection={captureSelection}
            onApply={(v) => execOnSelection('fontName', v)}
          />
          <FormatCombo
            title="Font size — 1-7 or any CSS size (px/rem)"
            placeholder="Size"
            width="w-16"
            options={FONT_SIZES}
            current={current.size}
            onCaptureSelection={captureSelection}
            onApply={applySize}
          />
          {!inline && (
            <>
              <select title="Paragraph style" className={selectCls} defaultValue="" onChange={resetThen((v) => exec('formatBlock', v))}>
                <option value="" disabled>Style</option>
                {BLOCKS.map((b) => <option key={b.tag} value={b.tag}>{b.label}</option>)}
              </select>
              {divider}
            </>
          )}
          <FormatCombo
            title="Text color — hex code or CSS colour name"
            placeholder="Color"
            width="w-20"
            color
            options={TEXT_COLORS}
            current={current.color}
            onCaptureSelection={captureSelection}
            onApply={(v) => execOnSelection('foreColor', v)}
          />
          <FormatCombo
            title="Highlight — hex code or CSS colour name"
            placeholder="Highlight"
            width="w-20"
            color
            options={HIGHLIGHTS}
            onCaptureSelection={captureSelection}
            onApply={(v) => execOnSelection('hiliteColor', v)}
          />
          {!inline && divider}
          {!inline && (
            <>
              <button type="button" title="Bulleted list" className={btn} onClick={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></button>
              <button type="button" title="Numbered list" className={btn} onClick={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></button>
              <button type="button" title="Quote" className={btn} onClick={() => exec('formatBlock', '<blockquote>')}><Quote className="h-4 w-4" /></button>
              {divider}
              <button type="button" title="Align left" className={btn} onClick={() => exec('justifyLeft')}><AlignLeft className="h-4 w-4" /></button>
              <button type="button" title="Align center" className={btn} onClick={() => exec('justifyCenter')}><AlignCenter className="h-4 w-4" /></button>
              <button type="button" title="Align right" className={btn} onClick={() => exec('justifyRight')}><AlignRight className="h-4 w-4" /></button>
              {divider}
            </>
          )}
          <button type="button" title="Insert link" className={btn} onClick={() => openPanel('link')}><Link2 className="h-4 w-4" /></button>
          {!inline && (
            <button type="button" title="Place image" className={btn} onClick={() => openPanel('image')}><ImagePlus className="h-4 w-4" /></button>
          )}
          {divider}
          <button type="button" title="Clear formatting" className={btn} onClick={() => exec('removeFormat')}><RemoveFormatting className="h-4 w-4" /></button>
          <button type="button" title="Undo" className={btn} onClick={() => exec('undo')}><Undo2 className="h-4 w-4" /></button>
          <button type="button" title="Redo" className={btn} onClick={() => exec('redo')}><Redo2 className="h-4 w-4" /></button>
        </div>

        {panel !== 'none' && (
          <div className="flex items-center gap-2 border-b border-surface-200 bg-surface-50 px-2.5 py-2">
            <span className="whitespace-nowrap text-xs font-medium text-surface-600">
              {panel === 'link' ? 'Link URL' : 'Image URL'}
            </span>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); insert(panel); }
                if (e.key === 'Escape') setPanel('none');
              }}
              placeholder={panel === 'link' ? 'https://example.com' : 'https://example.com/photo.jpg'}
              className="h-7 flex-1 rounded-md border border-surface-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/40"
            />
            <button
              type="button"
              className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
              onClick={() => insert(panel)}
            >
              Insert
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-surface-600 hover:bg-surface-100"
              onClick={() => setPanel('none')}
            >
              Cancel
            </button>
          </div>
        )}

        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={push}
          onBlur={push}
          onKeyDown={(e) => {
            if (inline && e.key === 'Enter') e.preventDefault();
          }}
          className="rte-content w-full overflow-auto px-3 py-2.5 text-sm leading-relaxed text-surface-900 outline-none"
          style={{ minHeight: minHeight ?? (inline ? 44 : 180) }}
        />
      </div>
      {hint && <p className="text-xs text-surface-500">{hint}</p>}
    </div>
  );
}