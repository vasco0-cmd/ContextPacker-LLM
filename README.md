# ContextPacker-LLM

High-performance repository context packing CLI and Model Context Protocol (MCP) server engineered for Large Language Models.

Designed and created by **VASCO**.

---

## Key Highlights

- **Dependency-Aware Context Slicing**: When focusing on specific files (`--focus <file_or_diff>`), target files are packaged in full text, direct 1-hop dependencies/importers are reduced to lightweight AST skeletons, and remaining codebase files are summarized as a directory tree.
- **Multi-Language AST Skeletonization**: Built on Web Tree-Sitter supporting TypeScript, JavaScript, Python, Go, and Rust. It extracts interfaces, type definitions, function and method signatures while stripping bodies.
- **Deterministic Token Budgeting**: Employs OpenAI's `cl100k_base` BPE tokenizer to strictly respect `--max-tokens`. Outputs are byte-for-byte identical across runs on the same commit.
- **Automatic Secret Sanitization**: Detects and redacts API keys (OpenAI, Anthropic, Google, AWS, GitHub, Slack) and generic passwords with `[REDACTED_SECRET]` without dropping the file structure.
- **Ignored Files Filtering**: Honors `.gitignore` and `.antigravityignore` rules while automatically skipping binary files, lockfiles (`package-lock.json`, `Cargo.lock`, etc.), and build outputs (`dist/`, `build/`, `target/`).
- **MCP Server Support**: Provides standard I/O (stdio) MCP server exposing `pack_context` and `get_repo_skeleton` tools.

---

## Installation

```bash
npm install -g contextpacker-llm
# or run directly with npx
npx contextpacker-llm --help
```

---

## CLI Usage

### 1. Basic Repository Packing
```bash
# Deterministic XML output of the entire repository
contextpacker

# Markdown format output
contextpacker --format markdown
```

### 2. Slicing by Focus or Git Diff
```bash
# Focus on specific source files
contextpacker --focus src/server.ts --format xml

# Focus on modified files from git diff
contextpacker --focus "git:HEAD~1"

# Focus on staged changes
contextpacker --focus "git:staged"
```

### 3. Strict Token Budgeting
```bash
# Pack repository strictly under 4000 tokens
contextpacker --max-tokens 4000 --output packed_context.xml
```

---

## MCP Server Integration

To connect `ContextPacker-LLM` to Claude Desktop, Cursor, or Antigravity, add the following to your MCP configuration file:

```json
{
  "mcpServers": {
    "contextpacker": {
      "command": "node",
      "args": ["path/to/dist/cli.js", "--mcp"],
      "env": {}
    }
  }
}
```

### Available MCP Tools

1. **`pack_context`**:
   - `focus`: Optional array of file paths to focus on.
   - `maxTokens`: Optional token budget limit.
   - `format`: `"xml"` (default) or `"markdown"`.

2. **`get_repo_skeleton`**:
   - `targetFiles`: Optional array of files to extract AST skeletons for.

---

## Benchmark & Performance Comparison

| Metric / Feature | Raw Concatenation / dump | Standard Repomix | ContextPacker-LLM |
| :--- | :--- | :--- | :--- |
| **Token Efficiency** | Baseline (100% token usage) | ~70-80% tokens | **20-40% tokens** (via AST Skeleton slicing) |
| **Secret Sanitization** | None | Basic regex | **Multi-pattern non-destructive masking** |
| **Determinist Output** | No | Partial | **Byte-for-byte identical** |
| **AST Grammars** | None | Limited | **TS/JS, Python, Go, Rust (Tree-sitter)** |
| **MCP Protocol** | No | Basic | **Native stdio MCP server** |

---

## Testing

Run the Vitest test suite covering scanner, AST skeletons, dependency graph slicing, token allocator, CLI, and MCP tools:

```bash
npm test
```

---

## License

MIT - Author: **VASCO**
