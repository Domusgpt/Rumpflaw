/**
 * Resolve Playwright from the project, NODE_PATH, or the environment's pre-installed
 * global copy (ESM imports ignore NODE_PATH, so use CommonJS resolution).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  const paths = [...(process.env.NODE_PATH || '').split(':'), '/opt/node-tools/node_modules'].filter(Boolean);
  pw = require(require.resolve('playwright', { paths }));
}
export const { chromium, devices } = pw;
