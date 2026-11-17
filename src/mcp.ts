/**
 * ContextPacker-LLM MCP Server
 * Author: VASCO
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { scanDirectory } from './scanner.js';
import { buildDependencyGraph, sliceRepository } from './graph.js';
import { packContext } from './packer.js';
import { extractSkeleton } from './skeleton.js';
import { sanitizeSecrets } from './sanitizer.js';
import * as fs from 'fs';
import * as path from 'path';

export function createMcpServer(workspaceRoot: string = process.cwd()): Server {
  const server = new Server(
    {
      name: 'contextpacker-llm',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'pack_context',
          description:
            'Deterministically packs repository context into XML or Markdown with secret sanitization, dependency slicing (focus full text, neighbors AST skeleton, distant tree) and max token budgeting.',
          inputSchema: {
            type: 'object',
            properties: {
              focus: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of focus file paths to include with full text.',
              },
              maxTokens: {
                type: 'number',
                description: 'Optional maximum token budget (cl100k_base tokenizer).',
              },
              format: {
                type: 'string',
                enum: ['xml', 'markdown'],
                description: 'Output format: "xml" (default) or "markdown".',
              },
            },
          },
        },
        {
          name: 'get_repo_skeleton',
          description:
            'Extracts clean AST signatures (functions, methods, classes, interfaces, types) for supported languages (TypeScript/JS, Python, Go, Rust) across the repository.',
          inputSchema: {
            type: 'object',
            properties: {
              targetFiles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional target files to extract skeleton for. If omitted, all detected repo code files are outlined.',
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'pack_context') {
      const focusList = (args?.focus as string[]) || [];
      const maxTokens = args?.maxTokens ? Number(args.maxTokens) : undefined;
      const format = (args?.format as 'xml' | 'markdown') || 'xml';

      const scanned = scanDirectory({ rootDir: workspaceRoot });
      const graph = buildDependencyGraph(scanned);
      const sliced = sliceRepository(scanned, graph, focusList.length > 0 ? focusList : undefined);

      const packed = await packContext({
        files: sliced,
        maxTokens,
        format,
      });

      return {
        content: [
          {
            type: 'text',
            text: packed.output,
          },
        ],
      };
    }

    if (name === 'get_repo_skeleton') {
      const targetFiles = (args?.targetFiles as string[]) || [];
      const scanned = scanDirectory({ rootDir: workspaceRoot });

      const filesToOutline =
        targetFiles.length > 0
          ? scanned.filter((f) => targetFiles.includes(f.relativePath))
          : scanned;

      const results: string[] = [];
      for (const file of filesToOutline) {
        let content = '';
        try {
          content = fs.readFileSync(file.absolutePath, 'utf-8');
        } catch {
          continue;
        }
        const sanitized = sanitizeSecrets(content).text;
        const skeleton = await extractSkeleton(file.relativePath, sanitized);
        results.push(`// --- Skeleton: ${file.relativePath} ---\n${skeleton}\n`);
      }

      return {
        content: [
          {
            type: 'text',
            text: results.join('\n'),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function startMcpStdio(workspaceRoot: string = process.cwd()): Promise<void> {
  const server = createMcpServer(workspaceRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
