/**
 * Author: VASCO
 */

import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, sliceRepository } from '../src/graph.js';

describe('Dependency Graph & Slicing Module', () => {
  it('extracts TypeScript import dependencies accurately', () => {
    const files = [
      { relativePath: 'src/main.ts', absolutePath: '/fake/src/main.ts' },
      { relativePath: 'src/utils.ts', absolutePath: '/fake/src/utils.ts' },
      { relativePath: 'src/config.ts', absolutePath: '/fake/src/config.ts' },
    ];

    const contents = new Map<string, string>([
      ['src/main.ts', "import { helper } from './utils.js';\nimport config from './config';"],
      ['src/utils.ts', 'export const helper = () => {};'],
      ['src/config.ts', 'export default { port: 3000 };'],
    ]);

    const graph = buildDependencyGraph(files, contents);
    expect(graph.nodes).toEqual(['src/config.ts', 'src/main.ts', 'src/utils.ts']);
    expect([...graph.edges.get('src/main.ts')!].sort()).toEqual(['src/config.ts', 'src/utils.ts']);
  });

  it('slices repository correctly into focus, neighbor skeleton, and distant tree tiers', () => {
    const files = [
      { relativePath: 'src/entry.ts', absolutePath: '/fake/src/entry.ts' },
      { relativePath: 'src/service.ts', absolutePath: '/fake/src/service.ts' },
      { relativePath: 'src/db.ts', absolutePath: '/fake/src/db.ts' },
      { relativePath: 'src/distant/unrelated.ts', absolutePath: '/fake/src/distant/unrelated.ts' },
    ];

    const contents = new Map<string, string>([
      ['src/entry.ts', "import { Service } from './service';"],
      ['src/service.ts', "import { DB } from './db';"],
      ['src/db.ts', 'export class DB {}'],
      ['src/distant/unrelated.ts', 'export const x = 42;'],
    ]);

    const graph = buildDependencyGraph(files, contents);

    // Focus on src/service.ts
    // Neighbors: src/entry.ts (imports service) and src/db.ts (imported by service)
    // Distant: src/distant/unrelated.ts
    const sliced = sliceRepository(files, graph, ['src/service.ts']);

    const entryTier = sliced.find((f) => f.relativePath === 'src/entry.ts')?.tier;
    const serviceTier = sliced.find((f) => f.relativePath === 'src/service.ts')?.tier;
    const dbTier = sliced.find((f) => f.relativePath === 'src/db.ts')?.tier;
    const distantTier = sliced.find((f) => f.relativePath === 'src/distant/unrelated.ts')?.tier;

    expect(serviceTier).toBe('focus_full');
    expect(dbTier).toBe('neighbor_skeleton');
    expect(entryTier).toBe('neighbor_skeleton');
    expect(distantTier).toBe('distant_tree');
  });

  it('defaults to all focus_full if no focus targets are specified', () => {
    const files = [
      { relativePath: 'a.ts', absolutePath: '/fake/a.ts' },
      { relativePath: 'b.ts', absolutePath: '/fake/b.ts' },
    ];
    const graph = buildDependencyGraph(files);
    const sliced = sliceRepository(files, graph);

    expect(sliced.every((f) => f.tier === 'focus_full')).toBe(true);
  });
});
