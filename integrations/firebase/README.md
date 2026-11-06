# Firebase middleware — inquiries & privacy-first telemetry

The static site (GitHub Pages) needs a small backend for two things. Both are optional;
until they're configured, the site's form shows a "please call" fallback in production
and a validated-but-not-sent demo mode on preview builds.

| Endpoint | Purpose | Stores |
|---|---|---|
| `POST /inquiry` | Contact-form intake. Validates with the **same schema as the browser** (`lib/inquiry-schema.js`), rate-limits 5/hour per client, writes to `inquiries`. | Name, phone/email, matter type, message, timestamps. **No IP addresses.** |
| `POST /collect` | First-party telemetry for `telemetry.adapter: "beacon"`. | Aggregate daily counters in `stats/{YYYY-MM-DD}` only — no identifiers. |

## Deploy (one time)

```bash
cd integrations/firebase
firebase use --add            # choose the firm's Firebase project
firebase functions:secrets:set IP_SALT      # any long random string
(cd functions && npm install)
firebase deploy --only functions,firestore:rules
```

Then, in the Google Cloud console for the project:

1. **Firestore TTL policy:** collection group `_ratelimits`, field `expireAt` (auto-deletes rate-limit keys).
2. **Params:** set `ALLOWED_ORIGINS` (e.g. `https://domusgpt.github.io,https://www.<firm-domain>`) when prompted on deploy, or in `functions/.env`.
3. *(Optional)* Install the **Trigger Email** extension and set `NOTIFY_TO` to staff addresses. The email only says
   that an inquiry arrived (matter type + reference id) — client details stay in Firestore.

## Wire the site to it

In `site.config.json`:

```json
"forms":     { "inquiry": { "adapter": "auto", "endpoint": "https://us-east4-<project>.cloudfunctions.net/inquiry" } },
"telemetry": { "adapter": "auto", "endpoint": "https://us-east4-<project>.cloudfunctions.net/collect" }
```

The build adds the endpoint origins to the page's Content-Security-Policy `connect-src` automatically.

## Keep the schema in sync

`functions/lib/inquiry-schema.js` must be byte-identical to `src/assets/js/lib/inquiry-schema.js`
(enforced by `tests/unit/schema-sync.test.mjs`):

```bash
cp src/assets/js/lib/inquiry-schema.js integrations/firebase/functions/lib/
```

## Confidentiality note for the firm

Inquiries sent before an engagement is confirmed are not privileged by default, and the site tells
visitors not to send confidential details. Restrict Firebase project access to the people who
handle intake, and set a retention period for the `inquiries` collection that matches the firm's
conflict-check and record-keeping policy.
