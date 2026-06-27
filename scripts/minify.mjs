import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '..', 'dist');

const files = fs.readdirSync(dist).filter(f => f.endsWith('.js') || f.endsWith('.css'));

for (const file of files) {
  const filePath = path.join(dist, file);
  const ext = path.extname(file);
  const result = await esbuild.transform(await fs.promises.readFile(filePath, 'utf-8'), {
    loader: ext === '.css' ? 'css' : 'js',
    minify: true,
  });
  fs.writeFileSync(filePath, result.code, 'utf-8');
  console.log(`  minified ${file} (${result.code.length}B)`);
}

console.log(`\u2713 minified ${files.length} files`);
