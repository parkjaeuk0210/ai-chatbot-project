import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { en } from '../js/i18n/en.js';
import { id } from '../js/i18n/id.js';
import { ja } from '../js/i18n/ja.js';
import { ko } from '../js/i18n/ko.js';
import { zh } from '../js/i18n/zh.js';

const root = new URL('../', import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('keeps the application shell externalized and on one API endpoint', async () => {
  const [html, main] = await Promise.all([
    read('index.html'),
    read('js/main.js')
  ]);

  assert.doesNotMatch(html, /<style(?:\s|>)/i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.match(html, /role="tablist"/);
  assert.match(html, /<dialog[^>]+id="settings-modal"/);
  assert.match(main, /const API_ENDPOINT = '\/api\/chat'/);
  assert.doesNotMatch(main, /\.innerHTML/);
  assert.doesNotMatch(main, /process\.env/);
  assert.doesNotMatch(main, /\/api\/chat-(?:simple|secure)/);
});

test('all supported languages expose the same translation contract', () => {
  const expected = Object.keys(ko).sort();

  for (const [language, translations] of Object.entries({ en, ja, zh, id })) {
    assert.deepEqual(
      Object.keys(translations).sort(),
      expected,
      `${language} translation keys differ from Korean`
    );
  }
});
