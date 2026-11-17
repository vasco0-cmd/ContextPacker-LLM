/**
 * ContextPacker-LLM Dependency Graph & Focus Slicer
 * Author: VASCO
 */
export type FileInclusionTier = 'focus_full' | 'neighbor_skeleton' | 'distant_tree';
export interface SlicedFile {
    relativePath: string;
    absolutePath: string;
    tier: FileInclusionTier;
}
export interface DependencyGraph {
    nodes: string[];
    edges: Map<string, Set<string>>;
}
/**
 * Builds deterministic dependency graph for the repo
 */
export declare function buildDependencyGraph(files: Array<{
    relativePath: string;
    absolutePath: string;
}>, fileContents?: Map<string, string>): DependencyGraph;
/**
 * Slices the repository files according to focus criteria:
 * - Focus files: tier 'focus_full'
 * - Direct imports/importers: tier 'neighbor_skeleton'
 * - Others: tier 'distant_tree'
 *
 * If no focus is provided, all files default to 'focus_full'.
 */
export declare function sliceRepository(files: Array<{
    relativePath: string;
    absolutePath: string;
}>, graph: DependencyGraph, focusTargets?: string[]): SlicedFile[];
