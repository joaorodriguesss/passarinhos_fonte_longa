import { mkdir, readFile, writeFile } from 'node:fs/promises';

const publicFiles = [
  'index.html',
  'styles.css',
  'supabase-config.js',
  'supabase-app.js',
  'chat-widget.js',
  'brand-logo.svg'
];

await mkdir('dist', { recursive: true });

async function writeIfChanged(path, contents) {
  try {
    if ((await readFile(path)).equals(contents)) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeFile(path, contents);
}

for (const file of publicFiles) {
  await writeIfChanged(`dist/${file}`, await readFile(file));
}

const assetsIgnore = Buffer.from(`*\n${publicFiles.map((file) => `!${file}`).join('\n')}\n`);
await writeIfChanged('dist/.assetsignore', assetsIgnore);