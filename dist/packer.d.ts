/**
 * ContextPacker-LLM Context Packer & Token Budget Allocator
 * Author: VASCO
 */
import { SlicedFile } from './graph.js';
export type OutputFormat = 'xml' | 'markdown';
export interface PackOptions {
    files: SlicedFile[];
    maxTokens?: number;
    format?: OutputFormat;
}
export interface PackResult {
    output: string;
    totalTokens: number;
    packedFilesCount: number;
    truncatedCount: number;
}
/**
 * Returns exact token count using cl100k_base encoding
 */
export declare function countTokens(text: string): number;
/**
 * Deterministically packs workspace files into XML or Markdown within budget.
 */
export declare function packContext(options: PackOptions): Promise<PackResult>;
