import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(projectRoot, 'public');

const staticFiles = [
  'index.html',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'favicon.ico'
];

const staticDirectories = [
  'icons',
  'assets'
];

const requiredFiles = [
  'index.html',
  'css/styles.css',
  'js/main.js'
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(relativePath, { required = false } = {}) {
  const source = join(projectRoot, relativePath);
  const destination = join(outputDirectory, relativePath);

  if (!(await exists(source))) {
    if (required) throw new Error(`Required static asset is missing: ${relativePath}`);
    return;
  }

  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
  console.log(`copied ${relativePath}`);
}

async function copyDirectory(relativePath) {
  const source = join(projectRoot, relativePath);
  if (!(await exists(source))) return;

  const destination = join(outputDirectory, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: true,
    filter: (sourcePath) => {
      const name = relative(source, sourcePath);
      return !name.startsWith('.') && !name.includes('node_modules');
    }
  });
  console.log(`copied ${relativePath}/`);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const relativePath of requiredFiles) {
  await copyFile(relativePath, { required: true });
}

await copyDirectory('js/i18n');

for (const relativePath of staticFiles) {
  if (!requiredFiles.includes(relativePath)) await copyFile(relativePath);
}

for (const relativePath of staticDirectories) {
  await copyDirectory(relativePath);
}

console.log(`PERA static build created at ${outputDirectory}`);
