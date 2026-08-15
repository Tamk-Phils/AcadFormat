import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ssrFile = path.resolve(
  __dirname,
  '../.vercel/output/functions/__server.func/_ssr/ssr.mjs'
);

if (fs.existsSync(ssrFile)) {
  let content = fs.readFileSync(ssrFile, 'utf8');

  // Fix Nitro Vite virtual plugin issue where ssr_exports is referenced without import
  if (content.includes('ssr_exports as a')) {
    content = content.replace(
      'ssr_exports as a',
      'server_default as a'
    );
    fs.writeFileSync(ssrFile, content, 'utf8');
    console.log('[patch-build] Successfully patched .vercel/output _ssr/ssr.mjs export reference.');
  }
}
