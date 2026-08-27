'use client';
// ─── Rich Text Editor ─────────────────────────────────────────────────
// Lightweight formatting toolbar (bold/italic/underline/strikethrough,
// font family + size, heading styles, lists, alignment, links and image
// placement) built on document.execCommand over a contentEditable area.
// No external dependencies.

import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
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

const FONT_FAMILIES = ['Arial', 'Courier New', 'Georgia', 'Inter', 'Times New Roman', 'Verdana'];
const FONT_SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Huge', value: '6' },
];
const BLOCKS = [
  { label: 'Paragraph', tag: '<p>' },
  { label: 'Heading 2', tag: '<h2>' },
  { label: 'Heading 3', tag: '<h3>' },
];

interface RichTextEditorProps {
  label?: string;
  /** HTML value (controlled). */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  hint?: string;
}

export function RichTextEditor({
  label,
  value,
  onChange,
  placeholder,
  minHeight = 180,
  hint,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [panel, setPanel] = useState<'none' | 'link' | 'image'>('none');
  const [url, setUrl] = useState('');

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
          <select title="Font family" className={selectCls} defaultValue="" onChange={resetThen((v) => exec('fontName', v))}>
            <option value="" disabled>Font</option>
            {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select title="Font size" className={selectCls} defaultValue="" onChange={resetThen((v) => exec('fontSize', v))}>
            <option value="" disabled>Size</option>
            {FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select title="Paragraph style" className={selectCls} defaultValue="" onChange={resetThen((v) => exec('formatBlock', v))}>
            <option value="" disabled>Style</option>
            {BLOCKS.map((b) => <option key={b.tag} value={b.tag}>{b.label}</option>)}
          </select>
          {divider}
          <button type="button" title="Bulleted list" className={btn} onClick={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></button>
          <button type="button" title="Numbered list" className={btn} onClick={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></button>
          <button type="button" title="Quote" className={btn} onClick={() => exec('formatBlock', '<blockquote>')}><Quote className="h-4 w-4" /></button>
          {divider}
          <button type="button" title="Align left" className={btn} onClick={() => exec('justifyLeft')}><AlignLeft className="h-4 w-4" /></button>
          <button type="button" title="Align center" className={btn} onClick={() => exec('justifyCenter')}><AlignCenter className="h-4 w-4" /></button>
          <button type="button" title="Align right" className={btn} onClick={() => exec('justifyRight')}><AlignRight className="h-4 w-4" /></button>
          {divider}
          <button type="button" title="Insert link" className={btn} onClick={() => openPanel('link')}><Link2 className="h-4 w-4" /></button>
          <button type="button" title="Place image" className={btn} onClick={() => openPanel('image')}><ImagePlus className="h-4 w-4" /></button>
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
          className="rte-content w-full overflow-auto px-3 py-2.5 text-sm leading-relaxed text-surface-900 outline-none"
          style={{ minHeight }}
        />
      </div>
      {hint && <p className="text-xs text-surface-500">{hint}</p>}
    </div>
  );
}