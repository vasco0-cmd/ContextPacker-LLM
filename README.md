# ContextPacker-LLM

High-performance repository context packing CLI and Model Context Protocol (MCP) server engineered for Large Language Models.

Designed and created by **VASCO**.

---

## Key Highlights

- **Pre-compiled Distribution**: Ready-to-run pre-compiled `dist/` directory included directly in the repository—no build or compile steps needed after cloning.
- **Dependency-Aware Context Slicing**: When focusing on specific files (`--focus <file_or_diff>`), target files are packaged in full text, direct 1-hop dependencies/importers are reduced to lightweight AST skeletons, and remaining codebase files are summarized as a directory tree.
- **Multi-Language AST Skeletonization**: Built on Web Tree-Sitter supporting TypeScript, JavaScript, Python, Go, and Rust. It extracts interfaces, type definitions, function and method signatures while stripping bodies.
- **Deterministic Token Budgeting**: Employs OpenAI's `cl100k_base` BPE tokenizer to strictly respect `--max-tokens`. Outputs are byte-for-byte identical across runs on the same commit.
- **Automatic Secret Sanitization**: Detects and redacts API keys (OpenAI, Anthropic, Google, AWS, GitHub, Slack) and generic passwords with `[REDACTED_SECRET]` without dropping the file structure.
- **Ignored Files Filtering**: Honors `.gitignore` and `.antigravityignore` rules while automatically skipping binary files, lockfiles (`package-lock.json`, `Cargo.lock`, etc.), and build outputs.
- **MCP Server Support**: Native standard I/O (stdio) MCP server exposing `pack_context` and `get_repo_skeleton` tools.

---

## Installation

> **Note:** This package is currently maintained directly on GitHub (not yet published to the public npm registry).

### Quick Install (Zero Build Needed)

Clone the repository and install runtime dependencies. Because the production `dist/` bundle is already included in the repo, you do not need to run a TypeScript build:

```bash
git clone https://github.com/vasco0-cmd/ContextPacker-LLM.git
cd ContextPacker-LLM
npm install
npm link
```

After running `npm link`, the `contextpacker` command will be globally available in your terminal:
```bash
contextpacker --help
```

Alternatively, you can run the CLI directly without global linking:
```bash
node dist/cli.js --help
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

### For Antigravity / Coding Agents
When using Antigravity or AI coding assistants, you can simply provide the repository URL `https://github.com/vasco0-cmd/ContextPacker-LLM.git` and ask the agent to install it. The agent clones the repo, runs `npm install`, and immediately connects to `dist/cli.js --mcp`.

### Configuration (Claude Desktop, Cursor, Antigravity)

Add the server to your MCP configuration JSON (`claude_desktop_config.json` or Antigravity MCP settings):

```json
{
  "mcpServers": {
    "contextpacker": {
      "command": "node",
      "args": ["<PATH_TO_REPO>/ContextPacker-LLM/dist/cli.js", "--mcp"]
    }
  }
}
```

*Replace `<PATH_TO_REPO>` with the absolute path where the repository is cloned.*

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
