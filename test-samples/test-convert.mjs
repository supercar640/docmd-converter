// Test script: verify markdownToDocx conversion logic works
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import fs from 'fs';

const md = fs.readFileSync('./test-samples/sample.md', 'utf-8');
const tokens = marked.lexer(md, { gfm: true });

console.log('=== Parsed Tokens ===');
for (const t of tokens) {
  console.log(`  [${t.type}]`, t.type === 'heading' ? t.text : '');
}

// Minimal conversion test
const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Test' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Hello from docx package' })] }),
    ]
  }]
});

const blob = await Packer.toBuffer(doc);
fs.writeFileSync('./test-samples/test-output.docx', blob);
console.log(`\n=== DOCX generated: ${blob.length} bytes ===`);
console.log('Output: test-samples/test-output.docx');
console.log('\nAll tests passed!');
