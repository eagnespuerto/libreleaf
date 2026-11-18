declare module '@libreleaf/doc-model' {
  export type PMNode = { type: string; attrs?: Record<string, any>; content?: PMNode[]; text?: string; marks?: { type: string; attrs?: Record<string, any> }[] };
  export function parse(src: string): PMNode;
  export function serialize(doc: PMNode): string;
  export function coverage(doc: PMNode, opts?: { bodyOnly?: boolean }): { rawChars: number; total: number; editable: number };
  export function editorNormalize(doc: PMNode): PMNode;
}
