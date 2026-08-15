import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(
  __dirname,
  '../node_modules/@tanstack/start-server-core/dist/esm/createStartHandler.js'
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Patch top-level defaultCsrfMiddleware instantiation to be lazy
  if (content.includes('var defaultCsrfMiddleware = createCsrfMiddleware')) {
    content = content.replace(
      'var defaultCsrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });',
      'var _defaultCsrfMiddleware;\nvar getDefaultCsrfMiddleware = () => (_defaultCsrfMiddleware ||= createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }));'
    );
    content = content.replace(
      '[defaultCsrfMiddleware]',
      '[getDefaultCsrfMiddleware()]'
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-tanstack] Successfully patched createStartHandler.js to fix Vercel SSR top-level circular import bug.');
  }
}
