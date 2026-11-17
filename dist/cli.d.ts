#!/usr/bin/env node
/**
 * ContextPacker-LLM CLI Interface
 * Author: VASCO
 */
/**
 * Resolves focus targets from a string.
 * Supports:
 * - Direct file paths (comma or space separated)
 * - Git diff comparison (e.g., "git:HEAD~1", "git:main", or "git:staged")
 */
export declare function resolveFocusTargets(focusInput: string, rootDir: string): string[];
export declare function runCli(argv?: string[]): Promise<void>;
