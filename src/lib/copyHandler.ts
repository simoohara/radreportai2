import DOMPurify from 'dompurify';

type CopyResult = 'html' | 'text' | 'failed';

const BLOCK_ELEMENTS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'FIGCAPTION', 'FIGURE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TR', 'UL',
]);

function unwrapAiHighlights(root: HTMLElement) {
  root.querySelectorAll('mark.ai-highlight').forEach((element) => {
    const fragment = document.createDocumentFragment();
    while (element.firstChild) fragment.appendChild(element.firstChild);
    element.parentNode?.replaceChild(fragment, element);
  });
}

/**
 * Keeps the report's original markup instead of rebuilding it into a reduced
 * section format. Inline styles make the copied document readable in editors
 * that do not load this application's stylesheet.
 */
function createClipboardHtml(html: string): string {
  const report = document.createElement('div');
  report.innerHTML = DOMPurify.sanitize(html);
  unwrapAiHighlights(report);

  report.querySelectorAll<HTMLElement>('p').forEach((paragraph) => {
    paragraph.style.margin = '0 0 8pt 0';
    paragraph.style.whiteSpace = 'pre-wrap';
  });
  report.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    heading.style.margin = '12pt 0 6pt 0';
    heading.style.fontFamily = 'Arial, Helvetica, sans-serif';
    heading.style.fontSize = '12pt';
    heading.style.lineHeight = '1.3';
  });
  report.querySelectorAll<HTMLElement>('strong, b').forEach((strong) => {
    strong.style.fontWeight = '700';
  });

  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #000000; white-space: normal;">${report.innerHTML}</div>`;
}

/** Create a readable plain-text fallback while retaining paragraph breaks. */
function createClipboardText(root: HTMLElement): string {
  const visit = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as HTMLElement;
    if (element.tagName === 'BR') return '\n';

    const content = Array.from(element.childNodes).map(visit).join('');
    return BLOCK_ELEMENTS.has(element.tagName) ? `${content}\n` : content;
  };

  return Array.from(root.childNodes)
    .map(visit)
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Safari and some embedded clinical applications do not support ClipboardItem.
 * Selecting an off-screen editable element makes the browser place HTML and
 * text representations on the clipboard through the legacy copy mechanism.
 */
function copyRichHtmlWithLegacyClipboard(html: string): boolean {
  const container = document.createElement('div');
  container.contentEditable = 'true';
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
  container.innerHTML = html;
  document.body.appendChild(container);

  const selection = window.getSelection();
  const existingRanges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : [];
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    return document.execCommand('copy');
  } finally {
    selection?.removeAllRanges();
    existingRanges.forEach((existingRange) => selection?.addRange(existingRange));
    container.remove();
  }
}

/**
 * Copy the report as styled HTML and as a structured text fallback.
 * AI-only highlight markers are removed before the report leaves the app.
 */
export async function copyReportToClipboard(html: string): Promise<CopyResult> {
  const clipboardHtml = createClipboardHtml(html);
  const textSource = document.createElement('div');
  textSource.innerHTML = clipboardHtml;
  const clipboardText = createClipboardText(textSource);

  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([clipboardHtml], { type: 'text/html' }),
          'text/plain': new Blob([clipboardText], { type: 'text/plain' }),
        }),
      ]);
      return 'html';
    } catch {
      // Fall through to the browser's legacy rich-text clipboard implementation.
    }
  }

  if (copyRichHtmlWithLegacyClipboard(clipboardHtml)) return 'html';

  try {
    await navigator.clipboard.writeText(clipboardText);
    return 'text';
  } catch {
    return 'failed';
  }
}
