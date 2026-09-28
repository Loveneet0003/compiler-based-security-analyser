import Parser from 'web-tree-sitter';
import { CFG, CFGNode } from './cfg';
import { DataFlowState } from './dataflow';

export interface SecurityIssue {
  ruleId: string;
  message: string;
  startPosition: Parser.Point;
  endPosition: Parser.Point;
}

export function runDetectors(root: Parser.SyntaxNode, cfg: CFG, dataFlow: DataFlowState, languageId: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const node of cfg.nodes) {
    if (node.isEntry) continue;
    // 1. Unreachable Code Detector
    // A node is unreachable if it has no predecessors and is not the entry node.
    if (!node.isEntry && node.predecessors.length === 0) {
      issues.push({
        ruleId: 'SEC001',
        message: 'Security Warning: Unreachable code detected. This may indicate a logic flaw.',
        startPosition: node.astNode.startPosition,
        endPosition: node.astNode.endPosition
      });
    }

    const state = dataFlow.get(node);
    if (state) {
      const text = node.astNode.text;

      // 2. Null Pointer Dereference Detector
      // Look for member access "var.property" or function calls "var()"
      for (const [varName, varState] of state.entries()) {
        if (varState.isStaticallyNull) {
          // Check if varName is used as a dereference in the current node's text
          // e.g. "x.foo", "x[0]", "x()"
          const derefRegex = new RegExp(`\\b${varName}\\s*(?:\\.|\\(|\\[)`);
          if (derefRegex.test(text)) {
            // Further verify the node actually contains this variable to avoid regex false positives
            if (node.astNode.text.includes(varName)) {
               issues.push({
                ruleId: 'SEC002',
                message: `Security Vulnerability: Possible Null Pointer Dereference on variable '${varName}'.`,
                startPosition: node.astNode.startPosition,
                endPosition: node.astNode.endPosition
              });
            }
          }
        }

        // 3. Buffer Misuse/Overflow Detector
        if (varState.isArray && varState.staticSize !== undefined) {
          // Look for array access "arr[index]"
          const accessRegex = new RegExp(`\\b${varName}\\s*\\[\\s*(\\d+)\\s*\\]`);
          const match = text.match(accessRegex);
          if (match) {
            const index = parseInt(match[1], 10);
            if (index >= varState.staticSize || index < 0) {
              issues.push({
                ruleId: 'SEC003',
                message: `Security Vulnerability: Buffer Overflow. Index ${index} is out of bounds for buffer '${varName}' of size ${varState.staticSize}.`,
                startPosition: node.astNode.startPosition,
                endPosition: node.astNode.endPosition
              });
            }
          }
        }
      }
    }
  }

  return issues;
}
