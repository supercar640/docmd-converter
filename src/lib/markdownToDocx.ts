import { marked, type Token, type Tokens } from 'marked';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ExternalHyperlink,
} from 'docx';

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

// Parse inline tokens into TextRun array
function parseInline(
  text: string,
  opts?: { bold?: boolean; italics?: boolean; strike?: boolean },
): TextRun[] {
  const tokens = marked.lexer(text, { gfm: true });
  const runs: TextRun[] = [];

  function walkInline(items: Token[], inherited: { bold?: boolean; italics?: boolean; strike?: boolean }) {
    for (const token of items) {
      switch (token.type) {
        case 'strong':
          walkInline((token as Tokens.Strong).tokens || [], { ...inherited, bold: true });
          break;
        case 'em':
          walkInline((token as Tokens.Em).tokens || [], { ...inherited, italics: true });
          break;
        case 'del':
          walkInline((token as Tokens.Del).tokens || [], { ...inherited, strike: true });
          break;
        case 'codespan':
          runs.push(
            new TextRun({
              text: (token as Tokens.Codespan).text,
              font: 'Consolas',
              size: 20,
              ...inherited,
            }),
          );
          break;
        case 'link':
          // For links, output as clickable hyperlink text
          runs.push(
            new TextRun({
              text: (token as Tokens.Link).text,
              style: 'Hyperlink',
              ...inherited,
            }),
          );
          break;
        case 'text':
          runs.push(new TextRun({ text: (token as Tokens.Text).text, ...inherited }));
          break;
        case 'escape':
          runs.push(new TextRun({ text: (token as Tokens.Escape).text, ...inherited }));
          break;
        case 'br':
          runs.push(new TextRun({ break: 1 }));
          break;
        default:
          if ('text' in token && typeof (token as { text: string }).text === 'string') {
            runs.push(new TextRun({ text: (token as { text: string }).text, ...inherited }));
          }
          break;
      }
    }
  }

  // Flatten: the top-level lexer returns block tokens; grab inline content
  for (const block of tokens) {
    if ('tokens' in block && Array.isArray(block.tokens)) {
      walkInline(block.tokens, opts || {});
    } else if (block.type === 'text') {
      runs.push(new TextRun({ text: (block as Tokens.Text).text, ...opts }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, ...opts }));
  }

  return runs;
}

// Convert block-level markdown tokens to docx paragraphs
function convertTokens(tokens: Token[]): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const h = token as Tokens.Heading;
        elements.push(
          new Paragraph({
            heading: HEADING_MAP[h.depth] || HeadingLevel.HEADING_1,
            children: parseInline(h.text),
          }),
        );
        break;
      }

      case 'paragraph': {
        const p = token as Tokens.Paragraph;
        elements.push(
          new Paragraph({
            children: parseInline(p.text),
          }),
        );
        break;
      }

      case 'code': {
        const c = token as Tokens.Code;
        const lines = c.text.split('\n');
        for (const line of lines) {
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line || ' ',
                  font: 'Consolas',
                  size: 20,
                }),
              ],
              spacing: { line: 276 },
            }),
          );
        }
        break;
      }

      case 'blockquote': {
        const bq = token as Tokens.Blockquote;
        const inner = convertTokens(bq.tokens);
        for (const el of inner) {
          if (el instanceof Paragraph) {
            elements.push(
              new Paragraph({
                ...el,
                indent: { left: 720 },
                border: {
                  left: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 10 },
                },
              }),
            );
          } else {
            elements.push(el);
          }
        }
        break;
      }

      case 'list': {
        const list = token as Tokens.List;
        for (let i = 0; i < list.items.length; i++) {
          const item = list.items[i];
          const prefix = list.ordered ? `${(list.start || 1) + i}. ` : '- ';
          elements.push(
            new Paragraph({
              children: parseInline(prefix + item.text),
              indent: { left: 360 },
            }),
          );
        }
        break;
      }

      case 'table': {
        const t = token as Tokens.Table;
        const rows: TableRow[] = [];

        // Header row
        rows.push(
          new TableRow({
            children: t.header.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: parseInline(cell.text, { bold: true }),
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  width: { size: 100 / t.header.length, type: WidthType.PERCENTAGE },
                }),
            ),
          }),
        );

        // Data rows
        for (const row of t.rows) {
          rows.push(
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph({ children: parseInline(cell.text) })],
                    width: { size: 100 / t.header.length, type: WidthType.PERCENTAGE },
                  }),
              ),
            }),
          );
        }

        elements.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        );
        break;
      }

      case 'hr': {
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: '' })],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
          }),
        );
        break;
      }

      case 'space': {
        elements.push(new Paragraph({ children: [] }));
        break;
      }

      default: {
        if ('text' in token && typeof (token as { text: string }).text === 'string') {
          elements.push(
            new Paragraph({ children: parseInline((token as { text: string }).text) }),
          );
        }
        break;
      }
    }
  }

  return elements;
}

export async function convertMarkdownToDocx(markdownText: string): Promise<Blob> {
  const tokens = marked.lexer(markdownText, { gfm: true });
  const children = convertTokens(tokens);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children.length > 0 ? children : [new Paragraph({ children: [] })],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}
