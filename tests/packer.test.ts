/**
 * Author: VASCO
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { packContext, countTokens } from '../src/packer.js';
import { SlicedFile } from '../src/graph.js';
import { REDACTION_TAG } from '../src/sanitizer.js';

describe('Packer & Token Budget Allocator Module', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contextpacker-packer-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('accurately counts tokens using tiktoken cl100k_base', () => {
    const text = 'Hello world! This is ContextPacker-LLM.';
    const tokens = countTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(countTokens('')).toBe(0);
  });

  it('packs XML and redacts secrets in contents', async () => {
    const file1Path = path.join(tempDir, 'main.ts');
    fs.writeFileSync(file1Path, 'const key = "sk-1234567890abcdef1234567890abcdef";\nconsole.log(key);');

    const files: SlicedFile[] = [
      { relativePath: 'src/main.ts', absolutePath: file1Path, tier: 'focus_full' },
    ];

    const result = await packContext({
      files,
      format: 'xml',
    });

    expect(result.output).toContain('<context>');
    expect(result.output).toContain('<file path="src/main.ts" tier="focus_full">');
    expect(result.output).toContain(REDACTION_TAG);
    expect(result.output).not.toContain('sk-1234567890abcdef');
    expect(result.output).toContain('</context>');
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('generates markdown output format properly', async () => {
    const file1Path = path.join(tempDir, 'readme.txt');
    fs.writeFileSync(file1Path, 'Test file content');

    const files: SlicedFile[] = [
      { relativePath: 'readme.txt', absolutePath: file1Path, tier: 'focus_full' },
    ];

    const result = await packContext({
      files,
      format: 'markdown',
    });

    expect(result.output).toContain('# Repository Context');
    expect(result.output).toContain('## File: readme.txt (focus_full)');
    expect(result.output).toContain('Test file content');
  });

  it('respects maxTokens limit and truncates lower priority or oversized files', async () => {
    const file1Path = path.join(tempDir, 'a.ts');
    const file2Path = path.join(tempDir, 'b.ts');
    fs.writeFileSync(file1Path, 'const a = "short";');
    fs.writeFileSync(file2Path, 'const b = "' + 'long_string_'.repeat(100) + '";');

    const files: SlicedFile[] = [
      { relativePath: 'a.ts', absolutePath: file1Path, tier: 'focus_full' },
      { relativePath: 'b.ts', absolutePath: file2Path, tier: 'focus_full' },
    ];

    const budget = 35;
    const result = await packContext({
      files,
      maxTokens: budget,
      format: 'xml',
    });

    expect(result.totalTokens).toBeLessThanOrEqual(budget);
    expect(result.truncatedCount).toBeGreaterThan(0);
    expect(result.output).toContain('a.ts');
  });

  it('is byte-for-byte deterministic across repeated runs', async () => {
    const file1Path = path.join(tempDir, 'module1.ts');
    const file2Path = path.join(tempDir, 'module2.ts');
    fs.writeFileSync(file1Path, 'export function run() { return 1; }');
    fs.writeFileSync(file2Path, 'export const val = 2;');

    const files: SlicedFile[] = [
      { relativePath: 'b_mod.ts', absolutePath: file2Path, tier: 'neighbor_skeleton' },
      { relativePath: 'a_mod.ts', absolutePath: file1Path, tier: 'focus_full' },
      { relativePath: 'distant/file.ts', absolutePath: '/fake/distant.ts', tier: 'distant_tree' },
    ];

    const run1 = await packContext({ files, format: 'xml', maxTokens: 500 });
    const run2 = await packContext({ files, format: 'xml', maxTokens: 500 });

    expect(run1.output).toBe(run2.output);
    expect(run1.totalTokens).toBe(run2.totalTokens);
    expect(Buffer.from(run1.output).equals(Buffer.from(run2.output))).toBe(true);
  });
});
