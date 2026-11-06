import { test } from 'node:test';
import assert from 'node:assert/strict';
import { middleware } from '../../src/assets/js/telemetry.js';

test('scrubPII redacts emails and phone numbers in string props', () => {
  const out = middleware.scrubPII()({ name: 'x', props: { a: 'mail me at jo@example.com', b: 'call 609-555-0100 now', n: 3 } });
  assert.equal(out.props.a, 'mail me at [email]');
  assert.equal(out.props.b, 'call [number] now');
  assert.equal(out.props.n, 3);
});

test('scrubPII truncates long strings', () => {
  const out = middleware.scrubPII()({ name: 'x', props: { s: 'y'.repeat(500) } });
  assert.equal(out.props.s.length, 200);
});

test('sample(0) drops, sample(1) keeps', () => {
  assert.equal(middleware.sample(0)({ name: 'x' }), null);
  assert.deepEqual(middleware.sample(1)({ name: 'x' }), { name: 'x' });
});

test('dedupe drops identical events inside the window', () => {
  const d = middleware.dedupe(10_000);
  assert.ok(d({ name: 'cta', props: { cta: 'call' } }));
  assert.equal(d({ name: 'cta', props: { cta: 'call' } }), null);
  assert.ok(d({ name: 'cta', props: { cta: 'directions' } }));
});
