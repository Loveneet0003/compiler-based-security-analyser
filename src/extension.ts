import * as vscode from 'vscode';
import { AnalyzerEngine } from './analyzer';
import * as path from 'path';

let diagnosticCollection: vscode.DiagnosticCollection;
let analyzer: AnalyzerEngine;

export async function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('security-analyzer');
  context.subscriptions.push(diagnosticCollection);

  const wasmPath = path.join(context.extensionPath, 'wasm');
  analyzer = new AnalyzerEngine(wasmPath);
  
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

async function analyzeDocument(document: vscode.TextDocument) {
  // Only analyze specific languages to start with
  const supportedLanguages = ['javascript', 'typescript', 'c', 'cpp'];
  if (!supportedLanguages.includes(document.languageId)) {
    return;
  }

  const code = document.getText();
  const diagnostics = await analyzer.analyze(code, document.languageId);

  const vsDiagnostics: vscode.Diagnostic[] = diagnostics.map(d => {
    const range = new vscode.Range(
      d.startPosition.row, d.startPosition.column,
      d.endPosition.row, d.endPosition.column
    );
    const diag = new vscode.Diagnostic(range, d.message, vscode.DiagnosticSeverity.Warning);
    diag.source = 'SecurityAnalyzer';
    diag.code = d.ruleId;
    return diag;
  });

  diagnosticCollection.set(document.uri, vsDiagnostics);
}

export function deactivate() {
  diagnosticCollection.clear();
}
