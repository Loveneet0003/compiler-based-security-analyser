import { ParserService } from './parser';
import { buildCFG } from './cfg';
import { runDataFlow } from './dataflow';
import { runDetectors, SecurityIssue } from './detectors';

export class AnalyzerEngine {
  private parserService: ParserService;

  constructor(wasmPath: string) {
    this.parserService = new ParserService(wasmPath);
  }

  async init() {
    await this.parserService.init();
  }

  async analyze(code: string, languageId: string): Promise<SecurityIssue[]> {
    try {
      // 1. Lexical and Syntax Analysis
      const tree = await this.parserService.parse(code, languageId);
      if (!tree) {
        return [];
      }

      // 2. Build Control Flow Graph (simplified for the scope of this generic implementation)
      const cfg = buildCFG(tree.rootNode);

      // 3. Data Flow Analysis
      const dataFlowState = runDataFlow(cfg);

      // 4. Security Detectors
      const issues = runDetectors(tree.rootNode, cfg, dataFlowState, languageId);
      return issues;
    } catch (e) {
      console.error('Analysis error:', e);
      return [];
    }
  }
}
