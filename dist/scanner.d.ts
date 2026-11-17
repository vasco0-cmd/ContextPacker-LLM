/**
 * ContextPacker-LLM File Scanner
 * Author: VASCO
 */
export interface ScannedFile {
    relativePath: string;
    absolutePath: string;
    size: number;
}
export interface ScanOptions {
    rootDir: string;
    customIgnoreRules?: string[];
}
/**
 * Built-in default ignore patterns (build artifacts, caches, VCS, lockfiles)
 */
export declare const DEFAULT_IGNORE_PATTERNS: string[];
/**
 * Check if a file is binary by extension or null-byte heuristic
 */
export declare function isBinaryFile(filePath: string): boolean;
/**
 * Recursively scans directory and returns a deterministically sorted list of files.
 */
export declare function scanDirectory(options: ScanOptions): ScannedFile[];
