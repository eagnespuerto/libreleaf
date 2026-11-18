// Open and save .tex files. In the desktop app (Tauri) we use native dialogs
// and write to disk; in the browser we use a file picker and a download.
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export type Opened = { name: string; text: string; path?: string };

export async function openTex(): Promise<Opened | null> {
  if (isDesktop) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await open({ multiple: false, filters: [{ name: 'LaTeX', extensions: ['tex'] }] });
    if (typeof path !== 'string') return null;
    return { name: path.split(/[\\/]/).pop() || 'paper.tex', text: await readTextFile(path), path };
  }
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tex,text/x-tex,text/plain';
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Save the text. Returns the path written to (desktop) or undefined. */
export async function saveTex(name: string, text: string, path?: string, saveAs = false): Promise<string | undefined> {
  if (isDesktop) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    let target = saveAs ? undefined : path;
    if (!target) target = (await save({ defaultPath: name, filters: [{ name: 'LaTeX', extensions: ['tex'] }] })) ?? undefined;
    if (!target) return path;
    await writeTextFile(target, text);
    return target;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/x-tex' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return undefined;
}

const DRAFT_KEY = 'libreleaf.draft.v1';

export function loadDraft(): Opened | null {
  try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

export function storeDraft(d: Opened) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* private mode or full: keep going */ }
}
