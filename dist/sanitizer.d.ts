/**
 * ContextPacker-LLM Secret Sanitizer
 * Author: VASCO
 */
export interface SanitizationResult {
    text: string;
    redactedCount: number;
}
export declare const REDACTION_TAG = "[REDACTED_SECRET]";
/**
 * Scans content and replaces credentials, tokens, and secrets with [REDACTED_SECRET].
 * Deterministic and non-destructive to surrounding file structure.
 */
export declare function sanitizeSecrets(content: string): SanitizationResult;
