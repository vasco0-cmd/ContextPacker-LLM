#!/usr/bin/env node
/**
 * ContextPacker-LLM CLI Interface
 * Author: VASCO
 */
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { scanDirectory } from './scanner.js';
import { buildDependencyGraph, sliceRepository } from './graph.js';
import { packContext } from './packer.js';
import { startMcpStdio } from './mcp.js';
/**
 * Resolves focus targets from a string.
 * Supports:
 * - Direct file paths (comma or space separated)
 * - Git diff comparison (e.g., "git:HEAD~1", "git:main", or "git:staged")
 */
export function resolveFocusTargets(focusInput, rootDir) {
    const trimmed = focusInput.trim();
    if (trimmed.startsWith('git:')) {
        const gitTarget = trimmed.slice(4).trim();
        try {
            let command = 'git diff --name-only';
            if (gitTarget === 'staged') {
                command = 'git diff --name-only --cached';
            }
            else if (gitTarget.length > 0) {
                command = `git diff --name-only ${gitTarget}`;
            }
            const diffOutput = execSync(command, { cwd: rootDir, encoding: 'utf-8' });
            return diffOutput
                .split('\n')
                .map((l) => l.trim().replace(/\\/g, '/'))
                .filter((l) => l.length > 0);
        }
        catch {
            return [];
        }
    }
    // Comma or whitespace separated file list
    return trimmed
        .split(/[\s,]+/)
        .map((p) => p.trim().replace(/\\/g, '/'))
        .filter((p) => p.length > 0);
}
export async function runCli(argv = process.argv) {
    const program = new Command();
    program
        .name('contextpacker')
        .description('ContextPacker-LLM: High-performance repository context packer & MCP server for LLMs.')
        .version('1.0.0')
        .option('--mcp', 'Start ContextPacker-LLM as a standard I/O (stdio) MCP server')
        .option('-f, --focus <target>', 'Focus file paths or git diff target (e.g. "src/main.ts" or "git:HEAD~1")')
        .option('-m, --max-tokens <number>', 'Maximum token budget for packed context (cl100k_base)', (val) => parseInt(val, 10))
        .option('--format <type>', 'Output format: "xml" or "markdown"', 'xml')
        .option('-o, --output <file>', 'Save packed output directly to a file instead of stdout')
        .option('-c, --cwd <path>', 'Working directory path (defaults to current directory)', process.cwd());
    program.parse(argv);
    const options = program.opts();
    if (options.mcp) {
        await startMcpStdio(path.resolve(options.cwd));
        return;
    }
    const rootDir = path.resolve(options.cwd);
    const scanned = scanDirectory({ rootDir });
    let focusFiles;
    if (options.focus) {
        focusFiles = resolveFocusTargets(options.focus, rootDir);
    }
    const graph = buildDependencyGraph(scanned);
    const sliced = sliceRepository(scanned, graph, focusFiles);
    const format = (options.format === 'markdown' ? 'markdown' : 'xml');
    const packed = await packContext({
        files: sliced,
        maxTokens: options.maxTokens,
        format,
    });
    if (options.output) {
        const outPath = path.resolve(options.output);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, packed.output, 'utf-8');
        process.stderr.write(`Packed context successfully written to: ${outPath} (${packed.totalTokens} tokens)\n`);
    }
    else {
        process.stdout.write(packed.output);
    }
}
// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))) {
    runCli().catch((err) => {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(1);
    });
}
//# sourceMappingURL=cli.js.map