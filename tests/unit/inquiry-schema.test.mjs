import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry, looksAutomated, clean, MATTERS } from '../../src/assets/js/lib/inquiry-schema.js';

const valid = { name: 'Pat Example', phone: '(609) 555-0100', email: '', matter: 'estates', message: 'Question about probating my mother’s will.', ack: true };

test('accepts a complete inquiry with phone only', () => {
  const r = validateInquiry(valid);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
  assert.equal(r.data.matter, 'estates');
});

test('accepts email instead of phone', () => {
  assert.equal(validateInquiry({ ...valid, phone: '', email: 'pat@example.com' }).ok, true);
});

test('requires phone or email', () => {
  const r = validateInquiry({ ...valid, phone: '', email: '' });
  assert.equal(r.ok, false);
  assert.match(r.errors.phone, /phone number or an email/);
});

test('rejects short phone numbers and malformed email', () => {
  assert.ok(validateInquiry({ ...valid, phone: '555-0100' }).errors.phone);
  assert.ok(validateInquiry({ ...valid, phone: '', email: 'not-an-email' }).errors.email);
});

test('requires name, message and acknowledgement', () => {
  const r = validateInquiry({ ...valid, name: ' ', message: 'hi', ack: false });
  assert.deepEqual(Object.keys(r.errors).sort(), ['ack', 'message', 'name']);
});

test('ack accepts checkbox form values', () => {
  assert.equal(validateInquiry({ ...valid, ack: 'on' }).ok, true);
  assert.equal(validateInquiry({ ...valid, ack: 'false' }).ok, false);
});

test('unknown matter falls back to general', () => {
  assert.equal(validateInquiry({ ...valid, matter: '<script>' }).data.matter, 'general');
  assert.ok(MATTERS.includes('general'));
});

test('clean strips control characters, collapses spaces and enforces limits', () => {
  assert.equal(clean('  a\u0000b \t  c  ', 10), 'ab c');
  assert.equal(clean('x'.repeat(50), 10).length, 10);
  assert.equal(validateInquiry({ ...valid, message: 'm'.repeat(5000) }).data.message.length, 2000);
});

test('bot heuristics: honeypot and too-fast submissions', () => {
  assert.equal(looksAutomated({ honeypot: 'Acme', elapsedMs: 10_000 }), 'honeypot');
  assert.equal(looksAutomated({ honeypot: '', elapsedMs: 800 }), 'too-fast');
  assert.equal(looksAutomated({ honeypot: '', elapsedMs: 9000 }), null);
});
