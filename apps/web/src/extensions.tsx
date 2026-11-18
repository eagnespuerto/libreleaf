// Tiptap nodes and marks that mirror packages/doc-model (option C).
// Anything the editor doesn't understand stays as raw LaTeX, shown in
// monospace, and can be edited as text. Nothing is ever dropped.
import { useEffect, useRef, useState } from 'react';
import {
  Extension, Mark, Node, mergeAttributes,
  NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps,
} from '@tiptap/react';

const hidden = (fallback: unknown = null) => ({ default: fallback, rendered: false, keepOnSplit: false });

/** Layout attributes kept so that an untouched document exports byte-exact. */
export const LatexLayout = Extension.create({
  name: 'latexLayout',
  addGlobalAttributes() {
    return [
      { types: ['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList'], attributes: { sep: hidden() } },
      { types: ['heading'], attributes: { star: hidden(false) } },
      { types: ['bulletList', 'orderedList'], attributes: { lead: hidden() } },
      { types: ['listItem'], attributes: { pre: hidden() } },
      { types: ['italic', 'bold', 'smallCaps'], attributes: { cmd: hidden() } },
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    latex: {
      toggleSmallCaps: () => ReturnType;
      insertRawBlock: (latex?: string) => ReturnType;
      insertRawInline: (latex?: string) => ReturnType;
      insertFootnote: (latex?: string) => ReturnType;
    };
  }
}

export const SmallCaps = Mark.create({
  name: 'smallCaps',
  parseHTML: () => [{ tag: 'span.small-caps' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { class: 'small-caps' }), 0],
  addCommands() {
    return { toggleSmallCaps: () => ({ commands }) => commands.toggleMark(this.name) };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-k': () => this.editor.commands.toggleSmallCaps() };
  },
});

/** Edits a LaTeX string in place. Used by all three raw node views. */
function LatexField({ value, onChange, multiline, autoFocus, onDone }: {
  value: string; onChange: (v: string) => void; multiline?: boolean; autoFocus?: boolean; onDone?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const common = {
    ref, value, spellCheck: false,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => onChange(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape' || (!multiline && e.key === 'Enter')) { e.preventDefault(); onDone?.(); }
    },
    onBlur: () => onDone?.(),
  };
  return multiline
    ? <textarea {...common} className="latex-field" rows={Math.min(14, value.split('\n').length + 1)} />
    : <input {...common} className="latex-field inline" size={Math.max(4, value.length + 1)} />;
}

function RawBlockView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const latex: string = node.attrs.latex;
  const lines = latex.split('\n').length;
  const frame = /\\(begin|end)\{document\}/.test(latex);
  const [open, setOpen] = useState(lines <= 8 && !frame);
  const label = frame ? (latex.includes('\\begin{document}') ? 'Preamble' : 'End of document')
    : /^\s*%/.test(latex) ? 'Comment'
    : (/^\\begin\{([^}]*)\}/.exec(latex.trim())?.[1] ?? 'LaTeX');
  return (
    <NodeViewWrapper className={'raw-block' + (selected ? ' selected' : '')} data-kind={label}>
      <div className="raw-block-head" contentEditable={false}>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '▾' : '▸'} {label}
        </button>
        {!open && <span className="raw-block-peek">{latex.split('\n')[0].slice(0, 80)} · {lines} line{lines > 1 ? 's' : ''}</span>}
      </div>
      {open && <div contentEditable={false}>
        <LatexField multiline value={latex} onChange={v => updateAttributes({ latex: v })} />
      </div>}
    </NodeViewWrapper>
  );
}

function RawInlineView({ node, updateAttributes, selected, extension }: ReactNodeViewProps) {
  const [editing, setEditing] = useState(false);
  const latex: string = node.attrs.latex;
  const isNote = extension.name === 'footnote';
  const isMath = !isNote && /^(\$|\\\()/.test(latex);
  const isComment = !isNote && latex.startsWith('%');
  const cls = isNote ? 'footnote' : isMath ? 'raw-inline math' : isComment ? 'raw-inline comment' : 'raw-inline';
  return (
    <NodeViewWrapper as="span" className={cls + (selected ? ' selected' : '')} contentEditable={false}
      title={isNote ? 'Footnote: ' + latex : 'LaTeX: ' + latex} onDoubleClick={() => setEditing(true)}>
      {editing
        ? <LatexField autoFocus value={latex} onChange={v => updateAttributes({ latex: v })} onDone={() => setEditing(false)} />
        : isNote ? <sup className="footnote-mark" /> : <span className="raw-text">{latex.replace(/\n$/, '')}</span>}
    </NodeViewWrapper>
  );
}

export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ latex: { default: '' }, sep: hidden() }),
  parseHTML: () => [{ tag: 'div[data-raw-block]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-raw-block': '' })],
  addNodeView: () => ReactNodeViewRenderer(RawBlockView),
  addCommands() {
    return {
      insertRawBlock: (latex = '\\begin{center}\n\n\\end{center}') => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },
});

export const RawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ latex: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-raw-inline]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-raw-inline': '' })],
  addNodeView: () => ReactNodeViewRenderer(RawInlineView),
  addCommands() {
    return {
      insertRawInline: (latex = '$x$') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },
});

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ latex: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-footnote]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-footnote': '' })],
  addNodeView: () => ReactNodeViewRenderer(RawInlineView),
  addCommands() {
    return {
      insertFootnote: (latex = 'Footnote text.') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },
});
