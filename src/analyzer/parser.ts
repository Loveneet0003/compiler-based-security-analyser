import Parser from 'web-tree-sitter';
import * as path from 'path';

export class ParserService {
  private parser!: Parser;
  private wasmPath: string;
  private initialized = false;

  constructor(wasmPath: string) {
    this.wasmPath = wasmPath;
  }

  async init() {
    if (this.initialized) return;
    await Parser.init({
      locateFile: (file: string, prefix: string) => {
        if (file === 'tree-sitter.wasm') {
          return path.join(this.wasmPath, 'tree-sitter.wasm');
        }
        return prefix + file;
      }
    });
    this.parser = new Parser();
    this.initialized = true;
  }

  async parse(code: string, languageId: string): Promise<Parser.Tree | null> {
    if (!this.initialized) return null;

    let wasmFile = '';
    switch (languageId) {
      case 'javascript':
        wasmFile = 'tree-sitter-javascript.wasm';
        break;
      case 'typescript':
        wasmFile = 'tree-sitter-typescript.wasm';
        break;
      case 'c':
        wasmFile = 'tree-sitter-c.wasm';
        break;
      case 'cpp':
        wasmFile = 'tree-sitter-cpp.wasm';
        break;
      default:
        return null;
    }

    try {
      const fullPath = path.join(this.wasmPath, wasmFile);
      const Lang = await Parser.Language.load(fullPath);
      this.parser.setLanguage(Lang);
      return this.parser.parse(code);
    } catch (e) {
      console.error(`Failed to load grammar for ${languageId}:`, e);
      return null;
    }
  }
}
