/**
 * Author: VASCO
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scanDirectory, isBinaryFile } from '../src/scanner.js';

describe('Scanner Module', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contextpacker-scan-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('scans text files and ignores default exclusions (build, git, lockfiles)', () => {
    // Setup regular files
    fs.writeFileSync(path.join(tempDir, 'index.ts'), 'console.log("hello");');
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'src', 'app.ts'), 'export const app = {};');

    // Setup ignored files / directories
    fs.mkdirSync(path.join(tempDir, 'dist'));
    fs.writeFileSync(path.join(tempDir, 'dist', 'bundle.js'), 'packed code');
    fs.mkdirSync(path.join(tempDir, '.git'));
    fs.writeFileSync(path.join(tempDir, '.git', 'config'), 'git config');
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'Cargo.lock'), '');

    const files = scanDirectory({ rootDir: tempDir });
    const relativePaths = files.map((f) => f.relativePath);

    expect(relativePaths).toEqual(['index.ts', 'src/app.ts']);
  });

  it('honors .gitignore and .antigravityignore rules', () => {
    fs.writeFileSync(path.join(tempDir, 'keep.txt'), 'keep');
    fs.writeFileSync(path.join(tempDir, 'secret_draft.md'), 'secret');
    fs.writeFileSync(path.join(tempDir, 'temp.log'), 'log data');

    fs.writeFileSync(path.join(tempDir, '.gitignore'), '*.log\n');
    fs.writeFileSync(path.join(tempDir, '.antigravityignore'), 'secret_draft.md\n');

    const files = scanDirectory({ rootDir: tempDir });
    const relativePaths = files.map((f) => f.relativePath);

    expect(relativePaths).toContain('keep.txt');
    expect(relativePaths).not.toContain('secret_draft.md');
    expect(relativePaths).not.toContain('temp.log');
  });

  it('excludes binary files properly', () => {
    const pngPath = path.join(tempDir, 'logo.png');
    const binPath = path.join(tempDir, 'compiled.bin');
    const nullByteFile = path.join(tempDir, 'nullbyte.dat');

    fs.writeFileSync(pngPath, Buffer.from([1, 2, 3]));
    fs.writeFileSync(binPath, Buffer.from([4, 5, 6]));
    fs.writeFileSync(nullByteFile, Buffer.from([65, 0, 66]));

    expect(isBinaryFile(pngPath)).toBe(true);
    expect(isBinaryFile(binPath)).toBe(true);
    expect(isBinaryFile(nullByteFile)).toBe(true);

    const files = scanDirectory({ rootDir: tempDir });
    expect(files.length).toBe(0);
  });

  it('returns files in deterministic sorted order', () => {
    fs.writeFileSync(path.join(tempDir, 'z.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'a.ts'), '');
    fs.writeFileSync(path.join(tempDir, 'm.ts'), '');

    const files = scanDirectory({ rootDir: tempDir });
    const relativePaths = files.map((f) => f.relativePath);

    expect(relativePaths).toEqual(['a.ts', 'm.ts', 'z.ts']);
  });
});
