"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const analyzer_1 = require("./analyzer");
const path = __importStar(require("path"));
let diagnosticCollection;
let analyzer;
async function activate(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('security-analyzer');
    context.subscriptions.push(diagnosticCollection);
    const wasmPath = path.join(context.extensionPath, 'wasm');
    analyzer = new analyzer_1.AnalyzerEngine(wasmPath);
    await analyzer.init();
    const analyzeCommand = vscode.commands.registerCommand('security-analyzer.analyze', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            analyzeDocument(editor.document);
        }
    });
    context.subscriptions.push(analyzeCommand);
    vscode.workspace.onDidSaveTextDocument(document => {
        analyzeDocument(document);
    }, null, context.subscriptions);
    vscode.workspace.onDidOpenTextDocument(document => {
        analyzeDocument(document);
    }, null, context.subscriptions);
    if (vscode.window.activeTextEditor) {
        analyzeDocument(vscode.window.activeTextEditor.document);
    }
}
async function analyzeDocument(document) {
    // Only analyze specific languages to start with
    const supportedLanguages = ['javascript', 'typescript', 'c', 'cpp'];
    if (!supportedLanguages.includes(document.languageId)) {
        return;
    }
    const code = document.getText();
    const diagnostics = await analyzer.analyze(code, document.languageId);
    const vsDiagnostics = diagnostics.map(d => {
        const range = new vscode.Range(d.startPosition.row, d.startPosition.column, d.endPosition.row, d.endPosition.column);
        const diag = new vscode.Diagnostic(range, d.message, vscode.DiagnosticSeverity.Warning);
        diag.source = 'SecurityAnalyzer';
        diag.code = d.ruleId;
        return diag;
    });
    diagnosticCollection.set(document.uri, vsDiagnostics);
}
function deactivate() {
    diagnosticCollection.clear();
}
//# sourceMappingURL=extension.js.map