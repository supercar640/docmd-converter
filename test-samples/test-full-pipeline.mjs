// Full pipeline test: MD → DOCX → MD (round-trip partial check)
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import fs from 'fs';

// ---- MD → DOCX (simplified version of markdownToDocx.ts) ----
const md = fs.readFileSync('./test-samples/sample.md', 'utf-8');
const tokens = marked.lexer(md, { gfm: true });

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};

function parseInlineSimple(text) {
  return [new TextRun({ text })];
}

function convertTokens(tokens) {
  const elements = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        elements.push(new Paragraph({
          heading: HEADING_MAP[token.depth] || HeadingLevel.HEADING_1,
          children: parseInlineSimple(token.text),
        }));
        break;
      case 'paragraph':
        elements.push(new Paragraph({ children: parseInlineSimple(token.text) }));
        break;
      case 'code':
        for (const line of token.text.split('\n')) {
          elements.push(new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 20 })],
          }));
        }
        break;
      case 'list':
        for (let i = 0; i < token.items.length; i++) {
          const prefix = token.ordered ? `${(token.start || 1) + i}. ` : '- ';
          elements.push(new Paragraph({
            children: parseInlineSimple(prefix + token.items[i].text),
            indent: { left: 360 },
          }));
        }
        break;
      case 'table': {
        const rows = [];
        rows.push(new TableRow({
          children: token.header.map(cell => new TableCell({
            children: [new Paragraph({ children: parseInlineSimple(cell.text) })],
            width: { size: 100 / token.header.length, type: WidthType.PERCENTAGE },
          })),
        }));
        for (const row of token.rows) {
          rows.push(new TableRow({
            children: row.map(cell => new TableCell({
              children: [new Paragraph({ children: parseInlineSimple(cell.text) })],
              width: { size: 100 / token.header.length, type: WidthType.PERCENTAGE },
            })),
          }));
        }
        elements.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        break;
      }
      case 'blockquote':
        for (const sub of convertTokens(token.tokens)) {
          elements.push(sub);
        }
        break;
      case 'hr':
        elements.push(new Paragraph({ children: [new TextRun({ text: '---' })] }));
        break;
      case 'space':
        elements.push(new Paragraph({ children: [] }));
        break;
    }
  }
  return elements;
}

const children = convertTokens(tokens);
const doc = new Document({ sections: [{ properties: {}, children }] });
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('./test-samples/full-test.docx', buffer);
console.log(`[1/3] MD → DOCX: ${buffer.length} bytes`);

// ---- DOCX → HTML (mammoth) ----
const result = await mammoth.convertToHtml({ buffer });
console.log(`[2/3] DOCX → HTML: ${result.value.length} chars`);
if (result.messages.length > 0) {
  console.log('  Warnings:', result.messages.map(m => m.message));
}

// ---- HTML → MD (turndown) ----
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
turndownService.use(gfm);

const outputMd = turndownService.turndown(result.value);
fs.writeFileSync('./test-samples/roundtrip-output.md', outputMd);
console.log(`[3/3] HTML → MD: ${outputMd.length} chars`);

// Verify key content survived the round trip
const checks = [
  ['Heading', outputMd.includes('DocMD Converter')],
  ['Bold text', outputMd.includes('DocMD Converter')],
  ['List items', outputMd.includes('Markdown')],
  ['Table', outputMd.includes('mammoth')],
  ['Blockquote', outputMd.includes('브라우저')],
];

console.log('\n=== Round-trip verification ===');
let allPassed = true;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) allPassed = false;
}

console.log(`\n${allPassed ? 'All checks passed!' : 'Some checks FAILED!'}`);
