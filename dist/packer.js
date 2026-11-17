/**
 * ContextPacker-LLM Context Packer & Token Budget Allocator
 * Author: VASCO
 */
import * as fs from 'fs';
import { get_encoding } from 'tiktoken';
import { extractSkeleton } from './skeleton.js';
import { sanitizeSecrets } from './sanitizer.js';
let tokenizerInstance = null;
function getTokenizer() {
    if (!tokenizerInstance) {
        tokenizerInstance = get_encoding('cl100k_base');
    }
    return tokenizerInstance;
}
/**
 * Returns exact token count using cl100k_base encoding
 */
export function countTokens(text) {
    const enc = getTokenizer();
    return enc.encode(text).length;
}
/**
 * Generates an ASCII file tree for distant files
 */
function generateFileTree(paths) {
    const sorted = [...paths].sort();
    return sorted.map((p) => `- ${p}`).join('\n');
}
/**
 * Deterministically packs workspace files into XML or Markdown within budget.
 */
export async function packContext(options) {
    const format = options.format || 'xml';
    const maxTokens = options.maxTokens ?? Infinity;
    // Separate files deterministically into tiers
    // Priority order for inclusion: focus_full first, neighbor_skeleton second, distant_tree last
    const focusFiles = options.files
        .filter((f) => f.tier === 'focus_full')
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const neighborFiles = options.files
        .filter((f) => f.tier === 'neighbor_skeleton')
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const distantFiles = options.files
        .filter((f) => f.tier === 'distant_tree')
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    // Pre-generate directory tree section
    const treeSection = distantFiles.length > 0 ? generateFileTree(distantFiles.map((d) => d.relativePath)) : '';
    const prepared = [];
    // 1. Focus files (highest priority)
    for (const file of focusFiles) {
        let raw = '';
        try {
            raw = fs.readFileSync(file.absolutePath, 'utf-8');
        }
        catch {
            continue;
        }
        const sanitized = sanitizeSecrets(raw).text;
        prepared.push({
            relativePath: file.relativePath,
            tier: 'focus_full',
            content: sanitized,
        });
    }
    // 2. Neighbor files (medium priority)
    for (const file of neighborFiles) {
        let raw = '';
        try {
            raw = fs.readFileSync(file.absolutePath, 'utf-8');
        }
        catch {
            continue;
        }
        const sanitized = sanitizeSecrets(raw).text;
        const skeleton = await extractSkeleton(file.relativePath, sanitized);
        prepared.push({
            relativePath: file.relativePath,
            tier: 'neighbor_skeleton',
            content: skeleton,
        });
    }
    function render(items, tree) {
        if (format === 'xml') {
            const parts = ['<context>'];
            if (tree.length > 0) {
                parts.push('  <repository_tree>');
                parts.push(tree.split('\n').map((l) => `    ${l}`).join('\n'));
                parts.push('  </repository_tree>');
            }
            for (const item of items) {
                parts.push(`  <file path="${item.relativePath}" tier="${item.tier}">`);
                parts.push(item.content);
                parts.push('  </file>');
            }
            parts.push('</context>');
            return parts.join('\n');
        }
        else {
            const parts = ['# Repository Context\n'];
            if (tree.length > 0) {
                parts.push('## Project Directory Tree\n```text\n' + tree + '\n```\n');
            }
            for (const item of items) {
                parts.push(`## File: ${item.relativePath} (${item.tier})\n\`\`\`\n${item.content}\n\`\`\`\n`);
            }
            return parts.join('\n');
        }
    }
    // Budget allocation: Add items one by one deterministically
    const acceptedItems = [];
    let currentTree = treeSection;
    // Initial base render
    let baseOutput = render([], currentTree);
    let currentTokens = countTokens(baseOutput);
    // If even base exceeds budget, omit tree
    if (currentTokens > maxTokens && currentTree.length > 0) {
        currentTree = '';
        baseOutput = render([], '');
        currentTokens = countTokens(baseOutput);
    }
    let packedCount = 0;
    let truncatedCount = 0;
    for (const item of prepared) {
        const candidateItems = [...acceptedItems, item];
        const candidateOutput = render(candidateItems, currentTree);
        const candidateTokens = countTokens(candidateOutput);
        if (candidateTokens <= maxTokens) {
            acceptedItems.push(item);
            packedCount++;
        }
        else {
            truncatedCount++;
        }
    }
    const finalOutput = render(acceptedItems, currentTree);
    const finalTokens = countTokens(finalOutput);
    return {
        output: finalOutput,
        totalTokens: finalTokens,
        packedFilesCount: packedCount,
        truncatedCount,
    };
}
//# sourceMappingURL=packer.js.map