/**
 * ContextPacker-LLM Secret Sanitizer
 * Author: VASCO
 */

export interface SanitizationResult {
  text: string;
  redactedCount: number;
}

export const REDACTION_TAG = '[REDACTED_SECRET]';

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // OpenAI API Keys
  {
    name: 'OpenAI API Key',
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  },
  // GitHub Personal Access Token / Fine-grained / App Tokens
  {
    name: 'GitHub Token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
  },
  // AWS Access Key ID
  {
    name: 'AWS Access Key',
    regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
  },
  // Slack Tokens
  {
    name: 'Slack Token',
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*\b/g,
  },
  // Generic Private Keys
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  // Google / Gemini API Keys
  {
    name: 'Google API Key',
    regex: /\bAIza[0-9A-Za-z-_]{35}\b/g,
  },
  // Generic key/token/password assignments in code, JSON, env files, yaml
  {
    name: 'Key-Value Assignment Secret',
    regex: /((?:api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|password|passwd|db_pass)\s*[:=]\s*["'])([^"'\r\n]{6,})(["'])/gi,
  },
];

/**
 * Scans content and replaces credentials, tokens, and secrets with [REDACTED_SECRET].
 * Deterministic and non-destructive to surrounding file structure.
 */
export function sanitizeSecrets(content: string): SanitizationResult {
  let text = content;
  let redactedCount = 0;

  for (const { regex, name } of SECRET_PATTERNS) {
    if (name === 'Key-Value Assignment Secret') {
      text = text.replace(regex, (_match, prefix, secretVal, suffix) => {
        // Avoid double-redacting
        if (secretVal === REDACTION_TAG) {
          return `${prefix}${secretVal}${suffix}`;
        }
        redactedCount++;
        return `${prefix}${REDACTION_TAG}${suffix}`;
      });
    } else {
      text = text.replace(regex, (match) => {
        if (match === REDACTION_TAG) {
          return match;
        }
        redactedCount++;
        return REDACTION_TAG;
      });
    }
  }

  return { text, redactedCount };
}
