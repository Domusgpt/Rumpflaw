/**
 * inquiry-schema.js — isomorphic validation for the contact/inquiry form.
 * Used by the browser (forms.js) AND the Firebase function (integrations/firebase/functions).
 * Keep the two copies byte-identical — tests/unit/schema-sync.test.mjs enforces it.
 */
export const MATTERS = Object.freeze(['general', 'real-estate', 'estates', 'family', 'municipal', 'injury', 'bankruptcy', 'other']);

export const LIMITS = Object.freeze({ name: 120, phone: 32, email: 160, message: 2000, minMessage: 10 });

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trim, strip control characters, collapse internal runs of spaces (not newlines). */
export function clean(value, max) {
  return String(value ?? '')
    .replace(CONTROL_RE, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

export function normalizePhone(value) {
  return clean(value, LIMITS.phone).replace(/[^\d+()\-.\s x]/gi, '');
}

/**
 * Validate a raw inquiry payload.
 * @returns {{ ok: boolean, data: object, errors: Record<string,string> }}
 */
export function validateInquiry(raw = {}) {
  const data = {
    name: clean(raw.name, LIMITS.name),
    phone: normalizePhone(raw.phone),
    email: clean(raw.email, LIMITS.email).toLowerCase(),
    matter: MATTERS.includes(raw.matter) ? raw.matter : 'general',
    message: clean(raw.message, LIMITS.message),
    ack: raw.ack === true || raw.ack === 'on' || raw.ack === 'true',
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Please enter your name.';
  const digits = data.phone.replace(/\D/g, '');
  if (!data.phone && !data.email) {
    errors.phone = 'Please provide a phone number or an email address.';
  } else {
    if (data.phone && (digits.length < 10 || digits.length > 15)) errors.phone = 'Please enter a valid phone number, including area code.';
    if (data.email && !EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address.';
  }
  if (data.message.length < LIMITS.minMessage) errors.message = 'Please add a short description of how we can help.';
  if (!data.ack) errors.ack = 'Please confirm you understand this does not create an attorney-client relationship.';
  return { ok: Object.keys(errors).length === 0, data, errors };
}

/** Heuristic bot checks — the caller decides how to respond (we silently accept & drop). */
export function looksAutomated({ honeypot = '', elapsedMs = Infinity } = {}) {
  if (String(honeypot).trim() !== '') return 'honeypot';
  if (elapsedMs < 2500) return 'too-fast';
  return null;
}
