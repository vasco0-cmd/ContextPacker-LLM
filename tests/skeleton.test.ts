/**
 * Author: VASCO
 */

import { describe, it, expect } from 'vitest';
import { extractSkeleton, detectLanguage } from '../src/skeleton.js';

describe('AST Skeleton Extractor Module', () => {
  it('detects languages accurately', () => {
    expect(detectLanguage('index.ts')).toBe('typescript');
    expect(detectLanguage('server.js')).toBe('javascript');
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('lib.rs')).toBe('rust');
    expect(detectLanguage('doc.txt')).toBeNull();
  });

  it('extracts Python signatures and drops function bodies', async () => {
    const pythonCode = `
import os
from sys import argv

def add_numbers(a: int, b: int) -> int:
    result = a + b
    print("debugging line")
    return result

class Calculator:
    def multiply(self, x: float, y: float) -> float:
        return x * y
`;
    const skeleton = await extractSkeleton('calc.py', pythonCode);
    expect(skeleton).toContain('import os');
    expect(skeleton).toContain('from sys import argv');
    expect(skeleton).toContain('def add_numbers(a: int, b: int) -> int: ...');
    expect(skeleton).toContain('class Calculator:');
    expect(skeleton).toContain('def multiply(self, x: float, y: float) -> float: ...');
    expect(skeleton).not.toContain('debugging line');
  });

  it('extracts TypeScript/JavaScript interfaces, types and method signatures', async () => {
    const tsCode = `
import { Config } from './config.js';

export interface User {
  id: string;
  name: string;
}

export function greet(user: User): string {
  const msg = "Hello " + user.name;
  return msg;
}

export class Service {
  public run(task: string): void {
    console.log("Running", task);
  }
}
`;
    const skeleton = await extractSkeleton('service.ts', tsCode);
    expect(skeleton).toContain("import { Config } from './config.js';");
    expect(skeleton).toContain('export interface User');
    expect(skeleton).toContain('function greet(user: User): string;');
    expect(skeleton).toContain('class Service {');
    expect(skeleton).toContain('run(task: string): void;');
    expect(skeleton).not.toContain('Running');
  });

  it('extracts Go structs and function signatures', async () => {
    const goCode = `
package main

import "fmt"

type Server struct {
    Port int
}

func NewServer(port int) *Server {
    return &Server{Port: port}
}

func (s *Server) Start() error {
    fmt.Println("Listening...")
    return nil
}
`;
    const skeleton = await extractSkeleton('server.go', goCode);
    expect(skeleton).toContain('package main');
    expect(skeleton).toContain('import "fmt"');
    expect(skeleton).toContain('type Server struct');
    expect(skeleton).toContain('func NewServer(port int) *Server');
    expect(skeleton).toContain('func (s *Server) Start() error');
    expect(skeleton).not.toContain('Listening...');
  });

  it('extracts Rust structs, enums and function signatures', async () => {
    const rustCode = `
use std::collections::HashMap;

pub struct Cache {
    entries: HashMap<String, String>,
}

impl Cache {
    pub fn new() -> Self {
        Cache { entries: HashMap::new() }
    }
}

fn calculate_hash(data: &str) -> u64 {
    let mut sum = 0;
    sum += 1;
    sum
}
`;
    const skeleton = await extractSkeleton('cache.rs', rustCode);
    expect(skeleton).toContain('use std::collections::HashMap;');
    expect(skeleton).toContain('pub struct Cache');
    expect(skeleton).toContain('impl Cache {');
    expect(skeleton).toContain('fn new() -> Self;');
    expect(skeleton).toContain('fn calculate_hash(data: &str) -> u64;');
    expect(skeleton).not.toContain('let mut sum = 0;');
  });

  it('provides safe fallback for unsupported file types', async () => {
    const skeleton = await extractSkeleton('data.csv', 'id,name\n1,Vasco\n');
    expect(skeleton).toContain('// [Skeleton: Language not supported');
  });
});
