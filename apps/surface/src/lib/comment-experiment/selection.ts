import { REVISION, type Target } from './model';

export function selectorFor(element: HTMLElement, workspace: HTMLElement): string {
  if (!workspace.contains(element) || element === workspace) throw new Error('Select content inside the workspace.');
  const parts: string[] = [];
  let node: HTMLElement | null = element;
  while (node && node !== workspace) {
    const tag = node.tagName.toLowerCase();
    const siblings = [...(node.parentElement?.children ?? [])].filter(child => child.tagName === node!.tagName);
    const classes = [...node.classList].filter(name => !/^(svelte-|selected$|active$|compact$|hover|focus)/.test(name)).slice(0, 2).map(name => `.${CSS.escape(name)}`).join('');
    if (node.id) { parts.unshift(`${tag}#${CSS.escape(node.id)}${classes}`); return parts.join(' > '); }
    parts.unshift(`${tag}${classes}:nth-of-type(${siblings.indexOf(node) + 1})`);
    node = node.parentElement;
  }
  return `${workspace.tagName.toLowerCase()}#${CSS.escape(workspace.id)} > ${parts.join(' > ')}`;
}
export function describeTarget(element: HTMLElement, workspace: HTMLElement): Target {
  const selector = selectorFor(element, workspace);
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  let hash = 0;
  for (const char of selector) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return {
    id: element.id || `element-${(hash >>> 0).toString(16)}`,
    selector, label: selector,
    text: text.slice(0, 1000), revision: REVISION,
  };
}
export function resolveTarget(target: Target | null, workspace: HTMLElement): HTMLElement | null {
  if (!target) return null;
  try {
    const element = document.querySelector(target.selector);
    return element instanceof HTMLElement && element !== workspace && workspace.contains(element) ? element : null;
  } catch { return null; }
}
