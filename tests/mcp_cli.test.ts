/**
 * Author: VASCO
 */

import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/mcp.js';
import { resolveFocusTargets } from '../src/cli.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('MCP Server & CLI Integration', () => {
  it('parses direct focus paths in CLI helper', () => {
    const targets = resolveFocusTargets('src/app.ts, src/server.ts', process.cwd());
    expect(targets).toEqual(['src/app.ts', 'src/server.ts']);
  });

  it('exposes pack_context and get_repo_skeleton tools in MCP server', async () => {
    const server = createMcpServer(process.cwd());
    const listHandler = (server as any)._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    expect(listHandler).toBeDefined();

    const toolsResult = await listHandler({ method: 'tools/list' }, {});
    const toolNames = toolsResult.tools.map((t: any) => t.name);
    expect(toolNames).toContain('pack_context');
    expect(toolNames).toContain('get_repo_skeleton');
  });

  it('executes get_repo_skeleton via MCP call_tool handler', async () => {
    const server = createMcpServer(process.cwd());
    const callHandler = (server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);

    const result = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'get_repo_skeleton',
          arguments: {
            targetFiles: ['src/sanitizer.ts'],
          },
        },
      },
      {}
    );

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Skeleton: src/sanitizer.ts');
    expect(result.content[0].text).toContain('function sanitizeSecrets');
  });

  it('executes pack_context via MCP call_tool handler', async () => {
    const server = createMcpServer(process.cwd());
    const callHandler = (server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);

    const result = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'pack_context',
          arguments: {
            focus: ['src/sanitizer.ts'],
            format: 'markdown',
            maxTokens: 2500,
          },
        },
      },
      {}
    );

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('# Repository Context');
    expect(result.content[0].text).toContain('src/sanitizer.ts');
  });
});
