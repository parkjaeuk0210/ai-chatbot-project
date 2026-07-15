import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

async function exists(relativePath) {
  try {
    await stat(join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function collectJavaScriptFiles(directory) {
  const absoluteDirectory = join(projectRoot, directory);
  if (!(await exists(directory))) return [];

  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(absoluteDirectory, entry.name);
    const relativePath = relative(projectRoot, absolutePath);

    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(relativePath));
    } else if (['.js', '.mjs', '.cjs'].includes(extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

for (const requiredPath of [
  'index.html',
  'css/styles.css',
  'js/main.js',
  'api/chat.js',
  'server.js',
  'vercel.json'
]) {
  assert(await exists(requiredPath), `Missing required file: ${requiredPath}`);
}

const indexHtml = await readFile(join(projectRoot, 'index.html'), 'utf8');
const mainJavaScript = await readFile(join(projectRoot, 'js/main.js'), 'utf8');
const vercelConfig = JSON.parse(await readFile(join(projectRoot, 'vercel.json'), 'utf8'));

assert(indexHtml.trimStart().startsWith('<!DOCTYPE html>'), 'index.html must start with a doctype');
assert(!/<style(?:\s|>)/i.test(indexHtml), 'Inline <style> blocks are not allowed');
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(indexHtml), 'Inline scripts are not allowed');
assert(indexHtml.includes('id="chat-input"'), 'Chat input is missing');
assert(indexHtml.includes('id="settings-modal"'), 'Settings dialog is missing');
assert(indexHtml.includes('role="tablist"'), 'Accessible tab semantics are missing');
assert(mainJavaScript.includes("const API_ENDPOINT = '/api/chat'"), 'Frontend must use the unified /api/chat endpoint');
assert(!mainJavaScript.includes('/api/chat-simple'), 'Legacy /api/chat-simple endpoint reference remains');
assert(!mainJavaScript.includes('process.env'), 'Browser code must not reference process.env');
assert(!mainJavaScript.includes('.innerHTML'), 'Dynamic innerHTML is not allowed in the frontend');
assert(vercelConfig.outputDirectory === 'public', 'Vercel outputDirectory must be public');
assert(vercelConfig.functions?.['api/chat.js'], 'Vercel API function configuration is missing');

const javascriptFiles = [
  'server.js',
  ...await collectJavaScriptFiles('api'),
  ...await collectJavaScriptFiles('js'),
  ...await collectJavaScriptFiles('scripts'),
  ...await collectJavaScriptFiles('tests')
];

for (const relativePath of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', join(projectRoot, relativePath)], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    failures.push(`Syntax check failed for ${relativePath}:\n${result.stderr.trim()}`);
  }
}

if (failures.length) {
  console.error('Validation failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Validated ${javascriptFiles.length} JavaScript files and core application contracts.`);
