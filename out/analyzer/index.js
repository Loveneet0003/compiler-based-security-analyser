"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzerEngine = void 0;
const parser_1 = require("./parser");
const cfg_1 = require("./cfg");
const dataflow_1 = require("./dataflow");
const detectors_1 = require("./detectors");
class AnalyzerEngine {
    parserService;
    constructor(wasmPath) {
        this.parserService = new parser_1.ParserService(wasmPath);
    }
    async init() {
        await this.parserService.init();
    }
    async analyze(code, languageId) {
        try {
            // 1. Lexical and Syntax Analysis
            const tree = await this.parserService.parse(code, languageId);
            if (!tree) {
                return [];
            }
            // 2. Build Control Flow Graph (simplified for the scope of this generic implementation)
            const cfg = (0, cfg_1.buildCFG)(tree.rootNode);
            // 3. Data Flow Analysis
            const dataFlowState = (0, dataflow_1.runDataFlow)(cfg);
            // 4. Security Detectors
            const issues = (0, detectors_1.runDetectors)(tree.rootNode, cfg, dataFlowState, languageId);
            return issues;
        }
        catch (e) {
            console.error('Analysis error:', e);
            return [];
        }
    }
}
exports.AnalyzerEngine = AnalyzerEngine;
//# sourceMappingURL=index.js.map