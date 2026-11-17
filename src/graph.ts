/**
 * ContextPacker-LLM Dependency Graph & Focus Slicer
 * Author: VASCO
 */

import * as path from 'path';
import * as fs from 'fs';

export type FileInclusionTier = 'focus_full' | 'neighbor_skeleton' | 'distant_tree';

export interface SlicedFile {
  relativePath: string;
  absolutePath: string;
  tier: FileInclusionTier;
}

export interface DependencyGraph {
  nodes: string[]; // relative paths sorted
  edges: Map<string, Set<string>>; // file -> imported files (relative paths)
}

/**
 * Normalizes relative path to POSIX format
 */
function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Extracts import/require specifiers from TS/JS code
 */
function extractTsJsImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"])|(?:require\(['"]([^'"]+)['"]\))/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const specifier = match[1] || match[2];
    if (specifier && (specifier.startsWith('./') || specifier.startsWith('../'))) {
      imports.push(specifier);
    }
  }
  return imports;
}

/**
 * Extracts relative imports from Python code
 */
function extractPythonImports(content: string): string[] {
  const imports: string[] = [];
  const fromRegex = /from\s+(\.+[a-zA-Z0-9_.]*)\s+import/g;
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }
  return imports;
}

/**
 * Extracts module references from Rust code (mod foo; use foo::bar)
 */
function extractRustImports(content: string): string[] {
  const imports: string[] = [];
  const modRegex = /\bmod\s+([a-zA-Z0-9_]+);/g;
  let match;
  while ((match = modRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }
  return imports;
}

/**
 * Resolves a TS/JS relative specifier to an existing workspace file
 */
function resolveTsJsSpecifier(fromRelPath: string, specifier: string, fileSet: Set<string>): string | null {
  const fromDir = path.dirname(fromRelPath);
  const targetBase = normalizeRelPath(path.join(fromDir, specifier));

  // If specifier ends with .js, also check corresponding .ts / .tsx
  const stripJs = targetBase.replace(/\.js$/, '');

  const candidateBases = [targetBase, stripJs];
  const candidateExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '/index.ts', '/index.js'];

  for (const base of candidateBases) {
    for (const ext of candidateExtensions) {
      const candidate = base.endsWith(ext) && ext !== '' ? base : base + ext;
      if (fileSet.has(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Resolves a Python relative import to workspace files
 */
function resolvePythonSpecifier(fromRelPath: string, specifier: string, fileSet: Set<string>): string | null {
  const fromDir = path.dirname(fromRelPath);
  const cleanSpec = specifier.replace(/^\.+/, '');
  const relPathPart = cleanSpec.split('.').join('/');
  const candidate = normalizeRelPath(path.join(fromDir, relPathPart + '.py'));
  if (fileSet.has(candidate)) {
    return candidate;
  }
  const initCandidate = normalizeRelPath(path.join(fromDir, relPathPart, '__init__.py'));
  if (fileSet.has(initCandidate)) {
    return initCandidate;
  }
  return null;
}

/**
 * Resolves Rust mod declarations to relative paths
 */
function resolveRustSpecifier(fromRelPath: string, modName: string, fileSet: Set<string>): string | null {
  const fromDir = path.dirname(fromRelPath);
  const candidateFile = normalizeRelPath(path.join(fromDir, `${modName}.rs`));
  if (fileSet.has(candidateFile)) {
    return candidateFile;
  }
  const candidateMod = normalizeRelPath(path.join(fromDir, modName, 'mod.rs'));
  if (fileSet.has(candidateMod)) {
    return candidateMod;
  }
  return null;
}

/**
 * Builds deterministic dependency graph for the repo
 */
export function buildDependencyGraph(
  files: Array<{ relativePath: string; absolutePath: string }>,
  fileContents?: Map<string, string>
): DependencyGraph {
  const relativeList = files.map((f) => normalizeRelPath(f.relativePath)).sort();
  const fileSet = new Set(relativeList);
  const edges = new Map<string, Set<string>>();

  for (const f of relativeList) {
    edges.set(f, new Set<string>());
  }

  for (const f of files) {
    const rel = normalizeRelPath(f.relativePath);
    let content = fileContents?.get(rel);
    if (content === undefined) {
      try {
        content = fs.readFileSync(f.absolutePath, 'utf-8');
      } catch {
        continue;
      }
    }

    const ext = path.extname(rel).toLowerCase();
    const targetSet = edges.get(rel)!;

    if (['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'].includes(ext)) {
      const specifiers = extractTsJsImports(content);
      for (const spec of specifiers) {
        const resolved = resolveTsJsSpecifier(rel, spec, fileSet);
        if (resolved && resolved !== rel) {
          targetSet.add(resolved);
        }
      }
    } else if (ext === '.py') {
      const specifiers = extractPythonImports(content);
      for (const spec of specifiers) {
        const resolved = resolvePythonSpecifier(rel, spec, fileSet);
        if (resolved && resolved !== rel) {
          targetSet.add(resolved);
        }
      }
    } else if (ext === '.rs') {
      const mods = extractRustImports(content);
      for (const mod of mods) {
        const resolved = resolveRustSpecifier(rel, mod, fileSet);
        if (resolved && resolved !== rel) {
          targetSet.add(resolved);
        }
      }
    }
  }

  return {
    nodes: relativeList,
    edges,
  };
}

/**
 * Slices the repository files according to focus criteria:
 * - Focus files: tier 'focus_full'
 * - Direct imports/importers: tier 'neighbor_skeleton'
 * - Others: tier 'distant_tree'
 *
 * If no focus is provided, all files default to 'focus_full'.
 */
export function sliceRepository(
  files: Array<{ relativePath: string; absolutePath: string }>,
  graph: DependencyGraph,
  focusTargets?: string[]
): SlicedFile[] {
  const fileMap = new Map(files.map((f) => [normalizeRelPath(f.relativePath), f.absolutePath]));
  const sortedPaths = [...fileMap.keys()].sort();

  if (!focusTargets || focusTargets.length === 0) {
    return sortedPaths.map((p) => ({
      relativePath: p,
      absolutePath: fileMap.get(p) ?? p,
      tier: 'focus_full',
    }));
  }

  const normalizedFocus = new Set(
    focusTargets.map((t) => normalizeRelPath(t).replace(/^\.\//, ''))
  );

  const focusSet = new Set<string>();
  for (const p of sortedPaths) {
    if (normalizedFocus.has(p)) {
      focusSet.add(p);
    }
  }

  // Find 1-hop direct neighbors (both dependencies imported by focus, and dependents importing focus)
  const neighborSet = new Set<string>();
  for (const focusFile of focusSet) {
    // Forward dependencies
    const outgoing = graph.edges.get(focusFile);
    if (outgoing) {
      for (const dep of outgoing) {
        if (!focusSet.has(dep)) {
          neighborSet.add(dep);
        }
      }
    }

    // Reverse dependencies (who imports this focus file)
    for (const [node, targets] of graph.edges.entries()) {
      if (targets.has(focusFile) && !focusSet.has(node)) {
        neighborSet.add(node);
      }
    }
  }

  const result: SlicedFile[] = [];
  for (const p of sortedPaths) {
    let tier: FileInclusionTier = 'distant_tree';
    if (focusSet.has(p)) {
      tier = 'focus_full';
    } else if (neighborSet.has(p)) {
      tier = 'neighbor_skeleton';
    }

    const absPath = fileMap.get(p) ?? p;
    result.push({
      relativePath: p,
      absolutePath: absPath,
      tier,
    });
  }

  return result;
}
