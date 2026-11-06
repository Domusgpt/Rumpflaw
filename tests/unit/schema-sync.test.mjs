import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('browser and Firebase copies of the inquiry schema are identical', () => {
  const a = readFileSync(join(ROOT, 'src/assets/js/lib/inquiry-schema.js'), 'utf8');
  const b = readFileSync(join(ROOT, 'integrations/firebase/functions/lib/inquiry-schema.js'), 'utf8');
  assert.equal(b, a, 'Run: cp src/assets/js/lib/inquiry-schema.js integrations/firebase/functions/lib/');
});
