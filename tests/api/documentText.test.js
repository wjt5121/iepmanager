import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentText } from '../../server/documentText.js';
import { createExportArtifact } from '../../server/exportArtifacts.js';

test('PDF full source retains trailing evidence independently of bounded preview', () => {
  const text = 'Synthetic filler evidence. '.repeat(90) + 'TRAILING_GOAL_MARKER 80 percent accuracy.';
  const pdf = createExportArtifact({id:'long-source',label:'Synthetic long source',format:'pdf',payload:{sections:[{heading:'Evidence',bullets:[text]}]}});
  const parsed = extractDocumentText({name:'long.pdf',mimeType:'application/pdf',fileBase64:pdf.buffer.toString('base64')});
  assert.match(parsed.sourceText, /TRAILING_GOAL_MARKER/);
  assert.ok(parsed.sourceSegments.every(segment => segment.text.length <= 1200));
});

test('unsupported image and legacy DOC are not decoded as source text', () => {
  for (const name of ['worksheet.png', 'legacy.doc']) {
    assert.throws(() => extractDocumentText({name,fileBase64:Buffer.from('synthetic bytes').toString('base64')}), /Unsupported file type/);
  }
});
