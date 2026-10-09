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
let statusBarItem;
async function activate(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('security-analyzer');
    context.subscriptions.push(diagnosticCollection);
    // Status bar indicator for real-time security posture
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'security-analyzer.analyze';
    statusBarItem.text = '$(shield) Security: Ready';
    statusBarItem.tooltip = 'Compiler-Assisted Security Analyzer is active. Click to analyze current file.';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
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
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            analyzeDocument(editor.document);
        }
    }, null, context.subscriptions);
    if (vscode.window.activeTextEditor) {
        analyzeDocument(vscode.window.activeTextEditor.document);
    }
}
async function analyzeDocument(document) {
    // Supported languages
    const supportedLanguages = ['javascript', 'typescript', 'c', 'cpp'];
    if (!supportedLanguages.includes(document.languageId)) {
        if (statusBarItem) {
            statusBarItem.text = '$(shield) Security: Unsupported';
        }
        return;
    }
    const code = document.getText();
    const diagnostics = await analyzer.analyze(code, document.languageId);
    const vsDiagnostics = diagnostics.map(d => {
        const range = new vscode.Range(d.startPosition.row, d.startPosition.column, d.endPosition.row, d.endPosition.column);
        let severity = vscode.DiagnosticSeverity.Warning;
        if (d.severity === 'CRITICAL' || d.severity === 'HIGH') {
            severity = vscode.DiagnosticSeverity.Error;
        }
        else if (d.severity === 'LOW') {
            severity = vscode.DiagnosticSeverity.Information;
        }
        const diag = new vscode.Diagnostic(range, `[${d.ruleId} | ${d.cwe}] ${d.message}`, severity);
        diag.source = 'SecurityAnalyzer';
        diag.code = d.ruleId;
        return diag;
    });
    diagnosticCollection.set(document.uri, vsDiagnostics);
    // Update Status Bar
    if (statusBarItem) {
        if (vsDiagnostics.length === 0) {
            statusBarItem.text = '$(check) Security: Safe';
            statusBarItem.tooltip = 'Security Analyzer: No vulnerabilities detected in this file.';
        }
        else {
            statusBarItem.text = `$(alert) Security: ${vsDiagnostics.length} issue${vsDiagnostics.length > 1 ? 's' : ''}`;
            statusBarItem.tooltip = `Security Analyzer: Detected ${vsDiagnostics.length} vulnerability(ies). Click to re-run.`;
        }
    }
}
function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.clear();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
//# sourceMappingURL=extension.js.map