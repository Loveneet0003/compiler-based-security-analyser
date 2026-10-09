import * as vscode from 'vscode';
import { AnalyzerEngine } from './analyzer';
import * as path from 'path';

let diagnosticCollection: vscode.DiagnosticCollection;
let analyzer: AnalyzerEngine;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
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

  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      analyzeDocument(editor.document);
    }
  }, null, context.subscriptions);

  if (vscode.window.activeTextEditor) {
    analyzeDocument(vscode.window.activeTextEditor.document);
  }
}

async function analyzeDocument(document: vscode.TextDocument) {
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

  const vsDiagnostics: vscode.Diagnostic[] = diagnostics.map(d => {
    const range = new vscode.Range(
      d.startPosition.row, d.startPosition.column,
      d.endPosition.row, d.endPosition.column
    );

    let severity = vscode.DiagnosticSeverity.Warning;
    if (d.severity === 'CRITICAL' || d.severity === 'HIGH') {
      severity = vscode.DiagnosticSeverity.Error;
    } else if (d.severity === 'LOW') {
      severity = vscode.DiagnosticSeverity.Information;
    }

    const diag = new vscode.Diagnostic(
      range, 
      `[${d.ruleId} | ${d.cwe}] ${d.message}`, 
      severity
    );
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
    } else {
      statusBarItem.text = `$(alert) Security: ${vsDiagnostics.length} issue${vsDiagnostics.length > 1 ? 's' : ''}`;
      statusBarItem.tooltip = `Security Analyzer: Detected ${vsDiagnostics.length} vulnerability(ies). Click to re-run.`;
    }
  }
}

export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.clear();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
