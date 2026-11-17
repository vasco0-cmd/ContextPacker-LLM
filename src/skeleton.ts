/**
 * ContextPacker-LLM AST Skeleton Extractor
 * Author: VASCO
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
const Parser = nodeRequire('web-tree-sitter');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust';

let parserInitialized = false;
let parserInstance: any = null;
const loadedLanguages: Map<string, any> = new Map();

/**
 * Resolves path to pre-built wasm files in tree-sitter-wasms
 */
function getWasmPath(langName: string): string {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', `tree-sitter-${langName}.wasm`),
    path.join(__dirname, '..', 'node_modules', 'tree-sitter-wasms', 'out', `tree-sitter-${langName}.wasm`),
    path.join(__dirname, 'node_modules', 'tree-sitter-wasms', 'out', `tree-sitter-${langName}.wasm`),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  try {
    const pkgJson = nodeRequire.resolve('tree-sitter-wasms/package.json');
    const wasmDir = path.join(path.dirname(pkgJson), 'out');
    const directPath = path.join(wasmDir, `tree-sitter-${langName}.wasm`);
    if (fs.existsSync(directPath)) {
      return directPath;
    }
  } catch {
    // ignore
  }

  return candidates[0];
}

/**
 * Detect language from file path extension
 */
export function detectLanguage(filePath: string): SupportedLanguage | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.py':
      return 'python';
    case '.go':
      return 'go';
    case '.rs':
      return 'rust';
    default:
      return null;
  }
}

/**
 * Initializes the web-tree-sitter runtime
 */
export async function initTreeSitter(): Promise<void> {
  if (!parserInitialized) {
    await Parser.init();
    parserInstance = new Parser();
    parserInitialized = true;
  }
}

/**
 * Loads a language grammar wasm on demand
 */
async function loadLanguage(lang: SupportedLanguage): Promise<any> {
  await initTreeSitter();

  const wasmName = lang === 'typescript' ? 'typescript' : lang;
  if (loadedLanguages.has(wasmName)) {
    return loadedLanguages.get(wasmName);
  }

  const wasmFile = getWasmPath(wasmName);
  const language = await Parser.Language.load(wasmFile);
  loadedLanguages.set(wasmName, language);
  return language;
}

/**
 * Extract AST skeleton for Python code
 */
function extractPythonSkeleton(rootNode: any, source: string): string {
  const lines: string[] = [];

  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);
    const type = node.type;

    if (type === 'import_statement' || type === 'import_from_statement') {
      lines.push(source.slice(node.startIndex, node.endIndex).trim());
    } else if (type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      const paramsNode = node.childForFieldName('parameters');
      const returnTypeNode = node.childForFieldName('return_type');
      const name = nameNode ? source.slice(nameNode.startIndex, nameNode.endIndex) : 'unknown';
      const params = paramsNode ? source.slice(paramsNode.startIndex, paramsNode.endIndex) : '()';
      const ret = returnTypeNode ? ` -> ${source.slice(returnTypeNode.startIndex, returnTypeNode.endIndex)}` : '';
      lines.push(`def ${name}${params}${ret}: ...`);
    } else if (type === 'class_definition') {
      const nameNode = node.childForFieldName('name');
      const superclassesNode = node.childForFieldName('superclasses');
      const name = nameNode ? source.slice(nameNode.startIndex, nameNode.endIndex) : 'unknown';
      const superclasses = superclassesNode ? source.slice(superclassesNode.startIndex, superclassesNode.endIndex) : '';
      const bodyNode = node.childForFieldName('body');

      lines.push(`class ${name}${superclasses}:`);
      if (bodyNode) {
        let hasMethod = false;
        for (let j = 0; j < bodyNode.childCount; j++) {
          const child = bodyNode.child(j);
          if (child.type === 'function_definition') {
            hasMethod = true;
            const mNameNode = child.childForFieldName('name');
            const mParamsNode = child.childForFieldName('parameters');
            const mReturnNode = child.childForFieldName('return_type');
            const mName = mNameNode ? source.slice(mNameNode.startIndex, mNameNode.endIndex) : 'unknown';
            const mParams = mParamsNode ? source.slice(mParamsNode.startIndex, mParamsNode.endIndex) : '()';
            const mRet = mReturnNode ? ` -> ${source.slice(mReturnNode.startIndex, mReturnNode.endIndex)}` : '';
            lines.push(`    def ${mName}${mParams}${mRet}: ...`);
          }
        }
        if (!hasMethod) {
          lines.push(`    ...`);
        }
      } else {
        lines.push(`    ...`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Extract AST skeleton for TypeScript and JavaScript code
 */
function extractTypeScriptSkeleton(rootNode: any, source: string): string {
  const lines: string[] = [];

  function formatTypeAnnotation(annotationNode: any): string {
    if (!annotationNode) return '';
    const raw = source.slice(annotationNode.startIndex, annotationNode.endIndex).trim();
    return raw.startsWith(':') ? raw : `: ${raw}`;
  }

  function processNode(node: any, prefix = ''): void {
    const type = node.type;

    if (type === 'import_statement') {
      lines.push(prefix + source.slice(node.startIndex, node.endIndex).trim());
    } else if (type === 'export_statement') {
      const decl = node.childForFieldName('declaration');
      if (decl) {
        processNode(decl, prefix + 'export ');
      } else {
        lines.push(prefix + source.slice(node.startIndex, node.endIndex).trim());
      }
    } else if (type === 'interface_declaration' || type === 'type_alias_declaration') {
      lines.push(prefix + source.slice(node.startIndex, node.endIndex).trim());
    } else if (type === 'function_declaration') {
      const name = node.childForFieldName('name');
      const params = node.childForFieldName('parameters');
      const returnType = node.childForFieldName('return_type');
      const nameStr = name ? source.slice(name.startIndex, name.endIndex) : '';
      const paramsStr = params ? source.slice(params.startIndex, params.endIndex) : '()';
      const retStr = formatTypeAnnotation(returnType);
      lines.push(`${prefix}function ${nameStr}${paramsStr}${retStr};`);
    } else if (type === 'class_declaration') {
      const name = node.childForFieldName('name');
      const nameStr = name ? source.slice(name.startIndex, name.endIndex) : 'AnonymousClass';
      const body = node.childForFieldName('body');
      lines.push(`${prefix}class ${nameStr} {`);
      if (body) {
        for (let i = 0; i < body.childCount; i++) {
          const m = body.child(i);
          if (m.type === 'method_definition') {
            const mName = m.childForFieldName('name');
            const mParams = m.childForFieldName('parameters');
            const mRet = m.childForFieldName('return_type');
            const mNameStr = mName ? source.slice(mName.startIndex, mName.endIndex) : '';
            const mParamsStr = mParams ? source.slice(mParams.startIndex, mParams.endIndex) : '()';
            const mRetStr = formatTypeAnnotation(mRet);
            lines.push(`  ${mNameStr}${mParamsStr}${mRetStr};`);
          } else if (m.type === 'property_signature' || m.type === 'field_definition') {
            lines.push(`  ${source.slice(m.startIndex, m.endIndex).trim()};`);
          }
        }
      }
      lines.push(`}`);
    }
  }

  for (let i = 0; i < rootNode.childCount; i++) {
    processNode(rootNode.child(i));
  }

  return lines.join('\n');
}

/**
 * Extract AST skeleton for Go code
 */
function extractGoSkeleton(rootNode: any, source: string): string {
  const lines: string[] = [];

  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);
    const type = node.type;

    if (type === 'package_clause' || type === 'import_declaration') {
      lines.push(source.slice(node.startIndex, node.endIndex).trim());
    } else if (type === 'type_declaration') {
      lines.push(source.slice(node.startIndex, node.endIndex).trim());
    } else if (type === 'function_declaration') {
      const name = node.childForFieldName('name');
      const params = node.childForFieldName('parameters');
      const result = node.childForFieldName('result');
      const nameStr = name ? source.slice(name.startIndex, name.endIndex) : '';
      const paramsStr = params ? source.slice(params.startIndex, params.endIndex) : '()';
      const resStr = result ? ` ${source.slice(result.startIndex, result.endIndex)}` : '';
      lines.push(`func ${nameStr}${paramsStr}${resStr}`);
    } else if (type === 'method_declaration') {
      const receiver = node.childForFieldName('receiver');
      const name = node.childForFieldName('name');
      const params = node.childForFieldName('parameters');
      const result = node.childForFieldName('result');
      const recStr = receiver ? `${source.slice(receiver.startIndex, receiver.endIndex)} ` : '';
      const nameStr = name ? source.slice(name.startIndex, name.endIndex) : '';
      const paramsStr = params ? source.slice(params.startIndex, params.endIndex) : '()';
      const resStr = result ? ` ${source.slice(result.startIndex, result.endIndex)}` : '';
      lines.push(`func ${recStr}${nameStr}${paramsStr}${resStr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Extract AST skeleton for Rust code
 */
function extractRustSkeleton(rootNode: any, source: string): string {
  const lines: string[] = [];

  function formatRustReturnType(returnType: any): string {
    if (!returnType) return '';
    const raw = source.slice(returnType.startIndex, returnType.endIndex).trim();
    return raw.startsWith('->') ? ` ${raw}` : ` -> ${raw}`;
  }

  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);
    const type = node.type;

    if (type === 'use_declaration') {
      lines.push(source.slice(node.startIndex, node.endIndex).trim());
    } else if (type === 'struct_item' || type === 'enum_item' || type === 'type_item') {
      lines.push(source.slice(node.startIndex, node.endIndex).trim());
    } else if (type === 'function_item') {
      const name = node.childForFieldName('name');
      const params = node.childForFieldName('parameters');
      const returnType = node.childForFieldName('return_type');
      const nameStr = name ? source.slice(name.startIndex, name.endIndex) : '';
      const paramsStr = params ? source.slice(params.startIndex, params.endIndex) : '()';
      const retStr = formatRustReturnType(returnType);
      lines.push(`fn ${nameStr}${paramsStr}${retStr};`);
    } else if (type === 'impl_item') {
      const typeNode = node.childForFieldName('type');
      const typeStr = typeNode ? source.slice(typeNode.startIndex, typeNode.endIndex) : 'Unknown';
      const body = node.childForFieldName('body');
      lines.push(`impl ${typeStr} {`);
      if (body) {
        for (let j = 0; j < body.childCount; j++) {
          const child = body.child(j);
          if (child.type === 'function_item') {
            const mName = child.childForFieldName('name');
            const mParams = child.childForFieldName('parameters');
            const mRet = child.childForFieldName('return_type');
            const mNameStr = mName ? source.slice(mName.startIndex, mName.endIndex) : '';
            const mParamsStr = mParams ? source.slice(mParams.startIndex, mParams.endIndex) : '()';
            const mRetStr = formatRustReturnType(mRet);
            lines.push(`    fn ${mNameStr}${mParamsStr}${mRetStr};`);
          }
        }
      }
      lines.push(`}`);
    }
  }

  return lines.join('\n');
}

/**
 * Extracts skeleton AST representation of a file.
 * If language is not supported or parsing fails, returns a safe truncated outline.
 */
export async function extractSkeleton(filePath: string, content: string): Promise<string> {
  const language = detectLanguage(filePath);
  if (!language) {
    return `// [Skeleton: Language not supported for AST outline. File: ${path.basename(filePath)}]`;
  }

  try {
    const lang = await loadLanguage(language);
    parserInstance.setLanguage(lang);
    const tree = parserInstance.parse(content);
    const root = tree.rootNode;

    switch (language) {
      case 'python':
        return extractPythonSkeleton(root, content);
      case 'typescript':
      case 'javascript':
        return extractTypeScriptSkeleton(root, content);
      case 'go':
        return extractGoSkeleton(root, content);
      case 'rust':
        return extractRustSkeleton(root, content);
    }
  } catch (err: any) {
    return `// [Skeleton generation fallback: ${err?.message || 'parse error'}]`;
  }
}
