import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { parse, serialize, type PMNode } from '@libreleaf/doc-model';
import { Footnote, LatexLayout, RawBlock, RawInline, SmallCaps } from './extensions';
import { isDesktop, loadDraft, openTex, saveTex, storeDraft } from './files';
import { countWords, formatCount } from './wordcount';
import { SAMPLE } from './sample';

const VERSION = '0.0.3';

/** LaTeX -> editor JSON. Line breaks inside running text become spaces. */
function toEditor(src: string): { json: PMNode; lead: string } {
  const doc = parse(src.replace(/\r\n/g, '\n'));
  const walk = (n: PMNode) => {
    if (n.type === 'text' && n.text) n.text = n.text.replace(/[ \t]*\n[ \t]*/g, ' ');
    n.content?.forEach(walk);
  };
  walk(doc);
  return { json: { type: 'doc', content: doc.content }, lead: doc.attrs?.lead ?? '' };
}

function toLatex(editor: Editor, lead: string) {
  return serialize({ ...(editor.getJSON() as PMNode), attrs: { lead } });
}

type TabId = 'home' | 'insert' | 'layout' | 'references' | 'review' | 'view';
const TABS: { id: TabId; label: string; soon?: boolean }[] = [
  { id: 'home', label: 'Home' }, { id: 'insert', label: 'Insert' },
  { id: 'layout', label: 'Layout', soon: true }, { id: 'references', label: 'References', soon: true },
  { id: 'review', label: 'Review', soon: true }, { id: 'view', label: 'View' },
];

function Btn({ on, active, title, latex, children, disabled }: {
  on: () => void; active?: boolean; title: string; latex?: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button type="button" className={'rb' + (active ? ' active' : '')} onMouseDown={e => e.preventDefault()}
      onClick={on} title={latex ? `${title} — ${latex}` : title} aria-pressed={active} disabled={disabled}>
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rgroup" role="group" aria-label={label}><div className="rgroup-body">{children}</div><div className="rgroup-label">{label}</div></div>;
}

export default function App() {
  const first = useMemo(() => loadDraft() ?? { name: 'paper.tex', text: SAMPLE }, []);
  const [name, setName] = useState(first.name);
  const [path, setPath] = useState<string | undefined>(first.path);
  const [tab, setTab] = useState<TabId>('home');
  const [showSource, setShowSource] = useState(false);
  const [latex, setLatex] = useState('');
  const [status, setStatus] = useState('');
  const lead = useRef('');
  const start = useMemo(() => { const r = toEditor(first.text); lead.current = r.lead; return r.json; }, [first]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        strike: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false,
        link: false, underline: false, trailingNode: false,
      }),
      LatexLayout, SmallCaps, RawBlock, RawInline, Footnote,
    ],
    content: start,
    editorProps: { attributes: { class: 'page', spellcheck: 'true', 'aria-label': 'Document' } },
    onUpdate: ({ editor }) => setLatex(toLatex(editor, lead.current)),
    onCreate: ({ editor }) => setLatex(toLatex(editor, lead.current)),
  });

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false, italic: e?.isActive('italic') ?? false, sc: e?.isActive('smallCaps') ?? false,
      h1: e?.isActive('heading', { level: 1 }) ?? false, h2: e?.isActive('heading', { level: 2 }) ?? false,
      h3: e?.isActive('heading', { level: 3 }) ?? false, ul: e?.isActive('bulletList') ?? false, ol: e?.isActive('orderedList') ?? false,
      undo: e?.can().undo() ?? false, redo: e?.can().redo() ?? false,
    }),
  });

  // Autosave the draft (debounced) and keep the word count live.
  const [count, setCount] = useState('');
  useEffect(() => {
    if (!latex) return;
    const t = setTimeout(() => {
      storeDraft({ name, text: latex, path });
      setCount(formatCount(countWords(latex)));
    }, 400);
    return () => clearTimeout(t);
  }, [latex, name, path]);

  const load = useCallback((text: string, fileName: string, filePath?: string) => {
    if (!editor) return;
    const r = toEditor(text);
    lead.current = r.lead;
    editor.commands.setContent(r.json, { emitUpdate: true });
    setName(fileName); setPath(filePath);
    setStatus(`Opened ${fileName}`);
  }, [editor]);

  const doOpen = async () => { const f = await openTex(); if (f) load(f.text, f.name, f.path); };
  const doSave = async (saveAs = false) => {
    if (!editor) return;
    const p = await saveTex(name, toLatex(editor, lead.current), path, saveAs);
    if (p) { setPath(p); setName(p.split(/[\\/]/).pop() || name); }
    setStatus(isDesktop ? (p ? `Saved ${p}` : 'Not saved') : `Downloaded ${name}`);
  };
  const doNew = () => { if (confirm('Start a new document? Your current draft will be replaced.')) load(SAMPLE, 'paper.tex'); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(e.shiftKey); }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); doOpen(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!editor) return null;
  const c = () => editor.chain().focus();

  return (
    <div className="app">
      <header className="titlebar">
        <span className="brand">LibreLeaf</span>
        <span className="docname" title={path}>{name}</span>
        <span className="badge">draft {VERSION}</span>
        <span className="spacer" />
        <button type="button" className="tb" onClick={doNew}>New</button>
        <button type="button" className="tb" onClick={doOpen} title="Ctrl+O">Open .tex</button>
        <button type="button" className="tb primary" onClick={() => doSave()} title="Ctrl+S">{isDesktop ? 'Save' : 'Download .tex'}</button>
      </header>

      <nav className="ribbon" aria-label="Ribbon">
        <div className="tabs" role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={'tab' + (tab === t.id ? ' on' : '')}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="toolbar" role="toolbar" aria-label={tab}>
          {tab === 'home' && <>
            <Group label="Edit">
              <Btn on={() => c().undo().run()} disabled={!s.undo} title="Undo (Ctrl+Z)">↶</Btn>
              <Btn on={() => c().redo().run()} disabled={!s.redo} title="Redo (Ctrl+Y)">↷</Btn>
            </Group>
            <Group label="Font">
              <Btn on={() => c().toggleBold().run()} active={s.bold} title="Bold (Ctrl+B)" latex="\textbf{…}"><b>B</b></Btn>
              <Btn on={() => c().toggleItalic().run()} active={s.italic} title="Emphasis (Ctrl+I)" latex="\emph{…}"><i>I</i></Btn>
              <Btn on={() => c().toggleSmallCaps().run()} active={s.sc} title="Small caps (Ctrl+Shift+K)" latex="\textsc{…}"><span className="small-caps">Sc</span></Btn>
            </Group>
            <Group label="Paragraph">
              <Btn on={() => c().toggleBulletList().run()} active={s.ul} title="Bulleted list" latex="itemize">• List</Btn>
              <Btn on={() => c().toggleOrderedList().run()} active={s.ol} title="Numbered list" latex="enumerate">1. List</Btn>
            </Group>
            <Group label="Styles">
              <Btn on={() => c().setParagraph().run()} active={!s.h1 && !s.h2 && !s.h3} title="Normal text">Normal</Btn>
              <Btn on={() => c().toggleHeading({ level: 1 }).run()} active={s.h1} title="Section" latex="\section">Section</Btn>
              <Btn on={() => c().toggleHeading({ level: 2 }).run()} active={s.h2} title="Subsection" latex="\subsection">Subsection</Btn>
              <Btn on={() => c().toggleHeading({ level: 3 }).run()} active={s.h3} title="Subsubsection" latex="\subsubsection">Sub-sub</Btn>
            </Group>
          </>}
          {tab === 'insert' && <>
            <Group label="Notes">
              <Btn on={() => c().insertFootnote().run()} title="Footnote" latex="\footnote{…}">Footnote</Btn>
            </Group>
            <Group label="Maths (preview)">
              <Btn on={() => c().insertRawInline('$x$').run()} title="Inline maths, edited as LaTeX for now" latex="$…$">x²</Btn>
              <Btn on={() => c().insertRawBlock('\\begin{equation}\n  E = mc^2\n\\end{equation}').run()} title="Displayed equation" latex="equation">Equation</Btn>
            </Group>
            <Group label="LaTeX">
              <Btn on={() => c().insertRawInline('\\cite{key}').run()} title="Inline LaTeX">Inline</Btn>
              <Btn on={() => c().insertRawBlock().run()} title="LaTeX block">Block</Btn>
            </Group>
          </>}
          {tab === 'view' && <>
            <Group label="Source">
              <Btn on={() => setShowSource(v => !v)} active={showSource} title="Show the LaTeX this document exports">LaTeX source</Btn>
            </Group>
          </>}
          {TABS.find(t => t.id === tab)?.soon && <p className="soon">Coming soon. See the roadmap for what lands when.</p>}
        </div>
      </nav>

      <main className={'workspace' + (showSource ? ' split' : '')}>
        <div className="canvas"><EditorContent editor={editor} /></div>
        {showSource && (
          <aside className="source" aria-label="LaTeX source (read-only)">
            <div className="source-head">LaTeX source · read-only</div>
            <pre>{latex}</pre>
          </aside>
        )}
      </main>

      <footer className="statusbar" aria-live="polite">
        <span>{count}</span>
        <span className="spacer" />
        <span>{status}</span>
        <span>{isDesktop ? 'Desktop' : 'Browser'} · draft autosaved</span>
      </footer>
    </div>
  );
}
