import { existsSync, readdirSync, rmSync, statSync } from 'fs';
import { basename, extname, join, relative } from 'path';

const root = process.cwd();

const disposableExtensions = new Set(['.tmp', '.temp', '.log']);
const disposablePrefixes = ['tmp-', 'temp-', 'cleanup-'];
const disposableScriptSuffixes = ['.tmp.ts', '.temp.ts', '.tmp.js', '.temp.js'];
const ignoreDirectories = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
const protectedRelativePaths = new Set(['scripts/cleanup-temp-files.ts']);
const removed: string[] = [];

function normalizeRelativePath(filePath: string): string {
  return relative(root, filePath).replace(/\\/g, '/');
}

function shouldDelete(filePath: string): boolean {
  const relativePath = normalizeRelativePath(filePath);
  if (protectedRelativePaths.has(relativePath)) {
    return false;
  }

  const name = basename(filePath);
  const ext = extname(filePath);

  if (name.endsWith('.tsbuildinfo')) {
    return true;
  }

  if (disposableExtensions.has(ext)) {
    return true;
  }

  if (disposableScriptSuffixes.some((suffix) => name.endsWith(suffix))) {
    return true;
  }

  if (disposablePrefixes.some((prefix) => name.startsWith(prefix)) && (ext === '.ts' || ext === '.js')) {
    return true;
  }

  return false;
}

function walk(directory: string): void {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (ignoreDirectories.has(entry)) {
        continue;
      }
      walk(fullPath);
      continue;
    }

    if (!shouldDelete(fullPath)) {
      continue;
    }

    rmSync(fullPath, { force: true });
    removed.push(normalizeRelativePath(fullPath));
  }
}

if (existsSync(root)) {
  walk(root);
}

if (removed.length === 0) {
  console.log('No disposable artifacts found.');
} else {
  console.log('Removed disposable artifacts:');
  for (const filePath of removed) {
    console.log(filePath);
  }
}
