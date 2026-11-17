/**
 * ContextPacker-LLM AST Skeleton Extractor
 * Author: VASCO
 */
export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
/**
 * Detect language from file path extension
 */
export declare function detectLanguage(filePath: string): SupportedLanguage | null;
/**
 * Initializes the web-tree-sitter runtime
 */
export declare function initTreeSitter(): Promise<void>;
/**
 * Extracts skeleton AST representation of a file.
 * If language is not supported or parsing fails, returns a safe truncated outline.
 */
export declare function extractSkeleton(filePath: string, content: string): Promise<string>;
