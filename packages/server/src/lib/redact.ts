import path from 'node:path';
import { getProjectRoot } from '../context';

function rootVariants(): string[] {
  const root = getProjectRoot();
  const forward = root.split(path.sep).join('/');
  const back = root.split('/').join('\\');
  const escapedBack = back.replace(/\\/g, '\\\\');
  // Longest first so the JSON-escaped form is replaced before its plain prefix.
  return [...new Set([escapedBack, back, forward, root])].sort((a, b) => b.length - a.length);
}

/** Replaces the absolute project root in every string with ".", so paths reach the browser project-relative. */
export function toProjectRelative<T>(value: T): T {
  const variants = rootVariants();
  const visit = (item: unknown): unknown => {
    if (typeof item === 'string') {
      let result = item;
      for (const variant of variants) result = result.split(variant).join('.');
      return result;
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, visit(entry)]));
    return item;
  };
  return visit(value) as T;
}
