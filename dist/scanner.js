/**
 * ContextPacker-LLM File Scanner
 * Author: VASCO
 */
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
/**
 * Built-in default ignore patterns (build artifacts, caches, VCS, lockfiles)
 */
export const DEFAULT_IGNORE_PATTERNS = [
    '.git',
    '.svn',
    '.hg',
    'node_modules',
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'obj',
    '.next',
    '.nuxt',
    '.cache',
    'coverage',
    '.turbo',
    // Lockfiles
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    'bun.lock',
    'Cargo.lock',
    'Gemfile.lock',
    'composer.lock',
    'poetry.lock',
    'mix.lock',
];
/**
 * Well-known binary file extensions
 */
const BINARY_EXTENSIONS = new Set([
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.svgz',
    '.mp3', '.mp4', '.wav', '.flac', '.ogg', '.m4a', '.avi', '.mov', '.mkv',
    '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar', '.xz',
    '.pdf', '.epub', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.wasm', '.pyc', '.pyo', '.pyd', '.class', '.jar', '.war',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.db', '.sqlite', '.sqlite3'
]);
/**
 * Check if a file is binary by extension or null-byte heuristic
 */
export function isBinaryFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
        return true;
    }
    try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(1024);
        const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
        fs.closeSync(fd);
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) {
                return true;
            }
        }
    }
    catch {
        // If unreadable, treat safely as non-binary or let caller handle read
    }
    return false;
}
/**
 * Loads ignore rules from .gitignore and .antigravityignore files
 */
function loadIgnoreInstance(rootDir, customRules = []) {
    const ig = ignore();
    // Add default built-in ignore patterns
    ig.add(DEFAULT_IGNORE_PATTERNS);
    // Read .gitignore if present
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        try {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            ig.add(content);
        }
        catch {
            // ignore read errors
        }
    }
    // Read .antigravityignore if present
    const agyIgnorePath = path.join(rootDir, '.antigravityignore');
    if (fs.existsSync(agyIgnorePath)) {
        try {
            const content = fs.readFileSync(agyIgnorePath, 'utf-8');
            ig.add(content);
        }
        catch {
            // ignore read errors
        }
    }
    if (customRules.length > 0) {
        ig.add(customRules);
    }
    return ig;
}
/**
 * Recursively scans directory and returns a deterministically sorted list of files.
 */
export function scanDirectory(options) {
    const rootDir = path.resolve(options.rootDir);
    const ig = loadIgnoreInstance(rootDir, options.customIgnoreRules);
    const results = [];
    function walk(currentDir) {
        let entries = [];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        // Sort directory entries deterministically by name
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            // Check ignore rules (append trailing slash for directory tests)
            const testPath = entry.isDirectory() ? `${relPath}/` : relPath;
            if (ig.ignores(testPath)) {
                continue;
            }
            if (entry.isDirectory()) {
                walk(fullPath);
            }
            else if (entry.isFile()) {
                if (!isBinaryFile(fullPath)) {
                    try {
                        const stats = fs.statSync(fullPath);
                        results.push({
                            relativePath: relPath,
                            absolutePath: fullPath,
                            size: stats.size,
                        });
                    }
                    catch {
                        // file disappeared or inaccessible
                    }
                }
            }
        }
    }
    walk(rootDir);
    // Deterministic final sorting by relative path
    results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return results;
}
//# sourceMappingURL=scanner.js.map