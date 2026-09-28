import { CFG, CFGNode } from './cfg';

export interface VariableState {
  isStaticallyNull: boolean;
  isArray: boolean;
  staticSize?: number;
}

export type DataFlowState = Map<CFGNode, Map<string, VariableState>>;

/**
 * A simplified heuristic-based data flow analyzer.
 * It tracks variable assignments (e.g., "x = null") across the simplified CFG.
 */
export function runDataFlow(cfg: CFG): DataFlowState {
  const state: DataFlowState = new Map();
  const globalVarState = new Map<string, VariableState>(); // Simplification: assume flat scope

  for (const node of cfg.nodes) {
    const text = node.astNode.text;
    
    // Very naive heuristic for detecting assignments to null
    // Matches patterns like "let x = null", "x = null"
    const nullAssignMatch = text.match(/(?:let|var|const)?\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*null/);
    if (nullAssignMatch) {
      const varName = nullAssignMatch[1];
      globalVarState.set(varName, { isStaticallyNull: true, isArray: false });
    }

    // Matches buffer allocation "let buf = new Array(10)" or "char buf[10]"
    const arrayMatch = text.match(/(?:let|var|const)?\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*new\s+(?:Array|Int8Array|Buffer)\((\d+)\)/);
    const cArrayMatch = text.match(/(?:int|char|float|double)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\[(\d+)\]/);
    
    if (arrayMatch) {
      globalVarState.set(arrayMatch[1], { isStaticallyNull: false, isArray: true, staticSize: parseInt(arrayMatch[2], 10) });
    } else if (cArrayMatch) {
      globalVarState.set(cArrayMatch[1], { isStaticallyNull: false, isArray: true, staticSize: parseInt(cArrayMatch[2], 10) });
    }

    // Reset null state if reassigned
    const assignMatch = text.match(/([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*([^;]+)/);
    if (assignMatch && !nullAssignMatch && !arrayMatch) {
      const varName = assignMatch[1];
      if (globalVarState.has(varName)) {
        const v = globalVarState.get(varName);
        if (v) v.isStaticallyNull = false;
      }
    }

    // Save a copy of the state for this node
    state.set(node, new Map(globalVarState));
  }

  return state;
}
