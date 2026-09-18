const omitted = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'SVG',
  'MATH',
  'TEMPLATE',
  'NOSCRIPT',
  'IMG',
]);
const blocks = new Set([
  'P',
  'DIV',
  'SECTION',
  'ARTICLE',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'PRE',
]);

/** GitHub's feed supplies HTML. Parse it inertly and return text, never live markup. */
export function releaseNotesText(source: string): string {
  const template = document.createElement('template');
  template.innerHTML = source;
  // Keep original line breaks for plain-text notes; the parser also decodes entities.
  if (!template.content.querySelector('*')) return template.content.textContent?.trim() || '';
  const visit = (node: Node, preformatted = false): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return preformatted ? text : text.replace(/\s+/g, ' ');
    }
    if (!(node instanceof Element)) return '';
    const tag = node.tagName;
    if (omitted.has(tag)) return '';
    if (tag === 'BR') return '\n';
    const text = Array.from(node.childNodes, (child) =>
      visit(child, preformatted || tag === 'PRE'),
    ).join('');
    if (tag === 'LI') return `• ${text.trim()}\n`;
    if (tag === 'UL' || tag === 'OL') return `\n${text.trim()}\n`;
    if (blocks.has(tag)) return `\n\n${text.trim()}\n\n`;
    if (tag === 'TR') return `${text.trim()}\n`;
    if (tag === 'TD' || tag === 'TH') return `${text}\t`;
    return text;
  };
  return Array.from(template.content.childNodes, (node) => visit(node))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
