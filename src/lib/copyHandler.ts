import DOMPurify from 'dompurify';

/**
 * Extract sections (INDICATION, TECHNIQUE, RÉSULTAT, CONCLUSION) from HTML.
 * Handles both nested (div-wrapped) and flat structures.
 */
function extractSectionsFromHtml(parentElement: HTMLElement): Record<string, string> {
  const sections: Record<string, string> = {};
  const sectionHeaders: Record<string, string[]> = {
    INDICATION: ['INDICATION'],
    TECHNIQUE: ['TECHNIQUE'],
    RÉSULTAT: ['RÉSULTAT', 'RESULTAT', 'RÉSULTATS', 'RESULTATS'],
    CONCLUSION: ['CONCLUSION'],
  };

  const getSectionKeyForElement = (element: Element | null): string | null => {
    if (!element) return null;
    const text = (element.textContent || '')
      .toUpperCase()
      .trim()
      .replace(':', '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const key in sectionHeaders) {
      if (sectionHeaders[key].includes(text)) return key;
    }
    return null;
  };

  const children = Array.from(parentElement.children);
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    let sectionKey: string | null = null;
    let contentElements: Element[] = [];

    // Case 1: Nested block (AI-generated template with <div>s)
    if (child.tagName === 'DIV' && child.children.length > 0) {
      const key = getSectionKeyForElement(child.children[0]);
      if (key) {
        sectionKey = key;
        contentElements = Array.from(child.children).slice(1);
        i++;
      }
    }

    // Case 2: Flat structure
    if (!sectionKey) {
      const key = getSectionKeyForElement(child);
      if (key) {
        sectionKey = key;
        let j = i + 1;
        while (j < children.length) {
          const nextChild = children[j];
          if (getSectionKeyForElement(nextChild)) break;
          if (
            nextChild.tagName === 'DIV' &&
            nextChild.children.length > 0 &&
            getSectionKeyForElement(nextChild.children[0])
          )
            break;
          contentElements.push(nextChild);
          j++;
        }
        i = j;
      } else {
        i++;
      }
    }

    if (sectionKey) {
      const mergedContent = contentElements
        .map((el) => el.innerHTML.trim())
        .filter((html) => html)
        .join('<br>');
      sections[sectionKey] = `<p>${mergedContent}</p>`;
    }
  }

  return sections;
}

/**
 * Copy the report HTML to clipboard in both HTML and plain text formats.
 * Strips AI highlight marks before copying.
 * Returns a promise that resolves to 'html' | 'text' | 'failed'.
 */
export async function copyReportToClipboard(html: string): Promise<'html' | 'text' | 'failed'> {
  // Create a temporary DOM element for processing
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = DOMPurify.sanitize(html);

  // Strip <mark class="ai-highlight"> — unwrap content
  tempDiv.querySelectorAll('mark.ai-highlight').forEach((el) => {
    const fragment = document.createDocumentFragment();
    while (el.firstChild) {
      fragment.appendChild(el.firstChild);
    }
    el.parentNode?.replaceChild(fragment, el);
  });

  const sections = extractSectionsFromHtml(tempDiv);

  const indicationContent = sections['INDICATION'] || '';
  const techniqueContent = sections['TECHNIQUE'] || '';
  const resultatContent = sections['RÉSULTAT'] || '';
  const conclusionContent = sections['CONCLUSION'] || '';

  // Build structured HTML for PACS
  const clipboardHtml = `
    <div><h2><strong>Indication :</strong></h2>${indicationContent.trim() || '<p></p>'}</div>
    <div><h2><strong>Technique :</strong></h2>${techniqueContent.trim() || '<p></p>'}</div>
    <div><h2><strong>Résultat :</strong></h2>${resultatContent.trim() || '<p></p>'}</div>
    <div><h2><strong>Conclusion :</strong></h2>${conclusionContent.trim() || '<p></p>'}</div>
  `
    .replace(/>\s+</g, '><')
    .trim();

  // Build plain text fallback
  const parser = new DOMParser();
  const textParts: string[] = [];
  if (indicationContent.trim() && indicationContent !== '<p></p>')
    textParts.push(`Indication :\n${parser.parseFromString(indicationContent, 'text/html').body.innerText.trim()}`);
  if (techniqueContent.trim() && techniqueContent !== '<p></p>')
    textParts.push(`Technique :\n${parser.parseFromString(techniqueContent, 'text/html').body.innerText.trim()}`);
  if (resultatContent.trim() && resultatContent !== '<p></p>')
    textParts.push(`Résultat :\n${parser.parseFromString(resultatContent, 'text/html').body.innerText.trim()}`);
  if (conclusionContent.trim() && conclusionContent !== '<p></p>')
    textParts.push(`Conclusion :\n${parser.parseFromString(conclusionContent, 'text/html').body.innerText.trim()}`);
  const clipboardText = textParts.join('\n\n');

  // Attempt rich copy
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([clipboardHtml], { type: 'text/html' }),
        'text/plain': new Blob([clipboardText], { type: 'text/plain' }),
      }),
    ]);
    return 'html';
  } catch {
    // Fallback to plain text
    try {
      await navigator.clipboard.writeText(clipboardText);
      return 'text';
    } catch {
      return 'failed';
    }
  }
}
