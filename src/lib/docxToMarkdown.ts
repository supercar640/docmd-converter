import mammoth from 'mammoth';
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

export async function convertDocxToMarkdown(
  arrayBuffer: ArrayBuffer,
): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const markdown = turndownService.turndown(result.value);
  return markdown;
}
