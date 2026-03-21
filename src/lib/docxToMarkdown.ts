import mammoth from 'mammoth';
import JSZip from 'jszip';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

turndownService.use(gfm);

// Replace base64 embedded images with a placeholder
turndownService.addRule('base64Images', {
  filter: (node) => {
    return (
      node.nodeName === 'IMG' &&
      (node as HTMLImageElement).src?.startsWith('data:')
    );
  },
  replacement: (_content, node) => {
    const alt = (node as HTMLImageElement).alt || 'image';
    return `![${alt}](embedded-image)`;
  },
});

interface DocxParagraphInfo {
  isEmpty: boolean;
  isHeading: boolean;
}

/**
 * Parse DOCX XML to build info about each body-level paragraph.
 */
async function getParagraphInfo(
  arrayBuffer: ArrayBuffer,
): Promise<DocxParagraphInfo[]> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) return [];

  const xml = await docXml.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const body = doc.getElementsByTagName('w:body')[0];
  if (!body) return [];

  const infos: DocxParagraphInfo[] = [];
  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    if (el.tagName !== 'w:p') continue;

    const texts = el.getElementsByTagName('w:t');
    let content = '';
    for (let j = 0; j < texts.length; j++) {
      content += texts[j].textContent ?? '';
    }

    const pStyles = el.getElementsByTagName('w:pStyle');
    let isHeading = false;
    if (pStyles.length > 0) {
      const val = pStyles[0].getAttribute('w:val') ?? '';
      isHeading = /^Heading/i.test(val);
    }

    infos.push({
      isEmpty: content.trim() === '',
      isHeading,
    });
  }
  return infos;
}

/**
 * Build group sizes of consecutive non-empty, non-heading paragraphs.
 * Empty paragraphs and headings act as group boundaries.
 *
 * Example: [heading, p, p, p, empty, p, p, heading, p]
 *   → group sizes: [3, 2, 1]
 * mammoth outputs headings as <h*> and skips empty paragraphs,
 * so only the normal paragraphs appear as <p> in HTML.
 */
function buildGroupSizes(infos: DocxParagraphInfo[]): number[] {
  const groups: number[] = [];
  let current = 0;

  for (const info of infos) {
    if (info.isEmpty || info.isHeading) {
      if (current > 0) {
        groups.push(current);
        current = 0;
      }
    } else {
      current++;
    }
  }
  if (current > 0) {
    groups.push(current);
  }
  return groups;
}

/**
 * Parse mammoth HTML into sequential parts: top-level <p>...</p> blocks
 * and everything else (headings, tables, etc.).
 * Block elements like <table>, <ul>, <ol> are treated as 'other' even if
 * they contain nested <p> tags.
 */
function parseHtmlParts(
  html: string,
): { type: 'p' | 'other'; html: string }[] {
  const parts: { type: 'p' | 'other'; html: string }[] = [];
  let remaining = html;

  const blockTags = ['table', 'ul', 'ol', 'blockquote', 'pre'];

  while (remaining.length > 0) {
    // Find the next <p> or block element, whichever comes first
    const pStart = remaining.indexOf('<p>');
    const pStartAttr = remaining.indexOf('<p ');
    let pIdx = -1;
    if (pStart >= 0 && pStartAttr >= 0) pIdx = Math.min(pStart, pStartAttr);
    else if (pStart >= 0) pIdx = pStart;
    else if (pStartAttr >= 0) pIdx = pStartAttr;

    // Check for block elements before <p>
    let blockIdx = -1;
    let blockTag = '';
    for (const tag of blockTags) {
      const idx = remaining.indexOf(`<${tag}`);
      if (idx >= 0 && (blockIdx === -1 || idx < blockIdx)) {
        blockIdx = idx;
        blockTag = tag;
      }
    }

    // If a block element comes before the next <p>, extract it as 'other'
    if (blockIdx >= 0 && (pIdx === -1 || blockIdx < pIdx)) {
      if (blockIdx > 0) {
        const before = remaining.substring(0, blockIdx);
        if (before.trim()) parts.push({ type: 'other', html: before });
        remaining = remaining.substring(blockIdx);
      }
      const closeTag = `</${blockTag}>`;
      const closeIdx = remaining.indexOf(closeTag);
      if (closeIdx === -1) {
        parts.push({ type: 'other', html: remaining });
        break;
      }
      const end = closeIdx + closeTag.length;
      parts.push({ type: 'other', html: remaining.substring(0, end) });
      remaining = remaining.substring(end);
      continue;
    }

    if (pIdx === -1) {
      if (remaining.trim()) parts.push({ type: 'other', html: remaining });
      break;
    }

    if (pIdx > 0) {
      const before = remaining.substring(0, pIdx);
      if (before.trim()) parts.push({ type: 'other', html: before });
      remaining = remaining.substring(pIdx);
    }

    const closeIdx = remaining.indexOf('</p>');
    if (closeIdx === -1) {
      parts.push({ type: 'other', html: remaining });
      break;
    }

    parts.push({ type: 'p', html: remaining.substring(0, closeIdx + 4) });
    remaining = remaining.substring(closeIdx + 4);
  }

  return parts;
}

/**
 * Merge consecutive <p> tags in mammoth HTML based on group sizes.
 * Within each group, <p> tags are joined with <br> instead of being
 * separate paragraphs, so Turndown produces \n instead of \n\n.
 */
function mergeConsecutiveParagraphs(
  html: string,
  groupSizes: number[],
): string {
  const parts = parseHtmlParts(html);

  // Flatten: assign each <p> part a group index and position
  // groupSizes tells us how many consecutive <p> tags belong together.
  // We consume <p> parts in order, grouping them by these sizes.
  const pParts: { index: number; inner: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].type === 'p') {
      const inner = parts[i].html
        .replace(/^<p[^>]*>/, '')
        .replace(/<\/p>$/, '');
      pParts.push({ index: i, inner });
    }
  }

  // Build a set of <p> part indices that should be merged
  // and what merged HTML they produce
  const mergedMap = new Map<number, string | null>();
  // null = this <p> was absorbed into a merged group (skip it)
  // string = the merged <p> HTML to output

  let pOffset = 0;
  for (const size of groupSizes) {
    if (size <= 1) {
      // Single paragraph - no merging needed
      pOffset += size;
      continue;
    }

    // Merge this group: combine all <p> inners with <br>
    const groupInners: string[] = [];
    for (let j = 0; j < size && pOffset + j < pParts.length; j++) {
      groupInners.push(pParts[pOffset + j].inner);
    }

    // First <p> in group gets the merged content
    mergedMap.set(pParts[pOffset].index, '<p>' + groupInners.join('<br>') + '</p>');

    // Remaining <p> parts in this group are absorbed
    for (let j = 1; j < size && pOffset + j < pParts.length; j++) {
      mergedMap.set(pParts[pOffset + j].index, null);
    }

    pOffset += size;
  }

  // Rebuild the HTML
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (mergedMap.has(i)) {
      const merged = mergedMap.get(i);
      if (merged !== null && merged !== undefined) {
        result.push(merged);
      }
      // null means skip (absorbed)
    } else {
      result.push(parts[i].html);
    }
  }

  return result.join('');
}

export async function convertDocxToMarkdown(
  arrayBuffer: ArrayBuffer,
): Promise<string> {
  const infos = await getParagraphInfo(arrayBuffer);
  const groupSizes = buildGroupSizes(infos);

  const result = await mammoth.convertToHtml({ arrayBuffer });
  const mergedHtml = mergeConsecutiveParagraphs(result.value, groupSizes);

  const markdown = turndownService.turndown(mergedHtml);
  return markdown;
}
