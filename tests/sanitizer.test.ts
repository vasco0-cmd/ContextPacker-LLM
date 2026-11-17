/**
 * Author: VASCO
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSecrets, REDACTION_TAG } from '../src/sanitizer.js';

describe('Sanitizer Module', () => {
  it('masks OpenAI and GitHub tokens', () => {
    const input = `
      const openAiKey = "sk-abcdef1234567890abcdef1234567890";
      const ghToken = "ghp_1234567890abcdef1234567890abcdef1234";
    `;
    const result = sanitizeSecrets(input);
    expect(result.text).toContain(`const openAiKey = "${REDACTION_TAG}";`);
    expect(result.text).toContain(`const ghToken = "${REDACTION_TAG}";`);
    expect(result.redactedCount).toBe(2);
  });

  it('masks AWS access keys and generic password declarations', () => {
    const input = `
      AWS_KEY = AKIA1234567890ABCDEF
      db_pass: "super_secret_password_123!"
      apiKey = "very_secret_service_token"
    `;
    const result = sanitizeSecrets(input);
    expect(result.text).toContain(`AWS_KEY = ${REDACTION_TAG}`);
    expect(result.text).toContain(`db_pass: "${REDACTION_TAG}"`);
    expect(result.text).toContain(`apiKey = "${REDACTION_TAG}"`);
  });

  it('masks private key blocks without breaking layout', () => {
    const input = `
# Server Configuration
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0123456789abcdef...
...dummy key content...
-----END RSA PRIVATE KEY-----
port = 8080
    `;
    const result = sanitizeSecrets(input);
    expect(result.text).toContain(REDACTION_TAG);
    expect(result.text).toContain('port = 8080');
    expect(result.text).not.toContain('dummy key content');
  });

  it('is deterministic on identical inputs', () => {
    const input = 'token = "sk-test1234567890abcdefghijklmnopqrstuvwxyz"';
    const run1 = sanitizeSecrets(input);
    const run2 = sanitizeSecrets(input);
    expect(run1.text).toBe(run2.text);
    expect(run1.redactedCount).toBe(run2.redactedCount);
  });
});
