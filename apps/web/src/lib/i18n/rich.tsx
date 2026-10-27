import { Fragment, type ReactNode } from 'react';

/** A translated text whose {name} slots hold elements, e.g. a bold @username inside a sentence. */
export function withNodes(text: string, nodes: Record<string, ReactNode>): ReactNode[] {
  // split() with a capturing group puts the slot names at the odd indexes.
  return text.split(/\{(\w+)\}/g).map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? `{${part}}`}</Fragment> : part));
}
