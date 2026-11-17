/**
 * ContextPacker-LLM MCP Server
 * Author: VASCO
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export declare function createMcpServer(workspaceRoot?: string): Server;
export declare function startMcpStdio(workspaceRoot?: string): Promise<void>;
