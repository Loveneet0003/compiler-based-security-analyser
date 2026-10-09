import Parser from 'web-tree-sitter';

export interface CFGNode {
  id: number;
  astNode: Parser.SyntaxNode;
  successors: CFGNode[];
  predecessors: CFGNode[];
  isEntry: boolean;
  isExit: boolean;
}

export interface CFG {
  entry: CFGNode;
  nodes: CFGNode[];
  reachableNodes: Set<CFGNode>;
}

/**
 * Control Flow Graph (CFG) builder.
 * Traverses the AST, models basic blocks and branch control flow (if/else),
 * captures early exits (return, throw), and computes reachability from entry.
 */
export function buildCFG(rootNode: Parser.SyntaxNode): CFG {
  const nodes: CFGNode[] = [];
  let idCounter = 0;

  function createNode(astNode: Parser.SyntaxNode, isEntry = false, isExit = false): CFGNode {
    const node: CFGNode = {
      id: idCounter++,
      astNode,
      successors: [],
      predecessors: [],
      isEntry,
      isExit
    };
    nodes.push(node);
    return node;
  }

  const entryNode = createNode(rootNode, true, false);

  function connect(from: CFGNode, to: CFGNode) {
    if (!from.successors.includes(to)) {
      from.successors.push(to);
    }
    if (!to.predecessors.includes(from)) {
      to.predecessors.push(from);
    }
  }

  function connectAll(fromNodes: CFGNode[], toNode: CFGNode) {
    for (const from of fromNodes) {
      connect(from, toNode);
    }
  }

  function getStatementChildren(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return node.children.filter(child => {
      const type = child.type;
      return type !== '{' && type !== '}' && type !== ';' && type !== 'comment';
    });
  }

  function processNode(node: Parser.SyntaxNode, incoming: CFGNode[]): CFGNode[] {
    // 1. Functions: create isolated flow connected from entry
    if (node.type.includes('function') || node.type === 'method_definition') {
      const body = node.childForFieldName('body') || 
                   node.children.find(c => c.type.includes('compound') || c.type.includes('block'));
      if (body) {
        const fnStmts = getStatementChildren(body);
        processStatements(fnStmts, [entryNode]);
      }
      return incoming;
    }

    // 2. Compound Blocks
    if (node.type === 'compound_statement' || node.type === 'statement_block' || node.type === 'block') {
      const stmts = getStatementChildren(node);
      return processStatements(stmts, incoming);
    }

    // 3. Conditional Branching (If Statement)
    if (node.type === 'if_statement') {
      const ifNode = createNode(node);
      connectAll(incoming, ifNode);

      const consequence = node.childForFieldName('consequence');
      const alternative = node.childForFieldName('alternative');

      let consequenceExits: CFGNode[] = [];
      if (consequence) {
        consequenceExits = processNode(consequence, [ifNode]);
      } else {
        consequenceExits = [ifNode];
      }

      let alternativeExits: CFGNode[] = [];
      if (alternative) {
        const altBody = alternative.type === 'else_clause'
          ? (alternative.children.find(c => c.type !== 'else' && c.type !== 'comment') || alternative)
          : alternative;
        alternativeExits = processNode(altBody, [ifNode]);
        return [...consequenceExits, ...alternativeExits];
      } else {
        return [...consequenceExits, ifNode];
      }
    }

    // 4. Early Exits (return / throw)
    if (node.type === 'return_statement' || node.type === 'throw_statement') {
      const exitNode = createNode(node, false, true);
      connectAll(incoming, exitNode);
      return []; // Control flow terminates here
    }

    // 5. Atomic Statements and Declarations
    const isStatement = node.type.includes('statement') || 
                        node.type.includes('declaration') || 
                        node.type.includes('assignment');

    if (isStatement) {
      const stmtNode = createNode(node);
      connectAll(incoming, stmtNode);
      return [stmtNode];
    }

    // Default: propagate through children
    let curr = incoming;
    for (const child of node.children) {
      curr = processNode(child, curr);
    }
    return curr;
  }

  function processStatements(stmts: Parser.SyntaxNode[], incoming: CFGNode[]): CFGNode[] {
    let curr = incoming;
    for (const stmt of stmts) {
      curr = processNode(stmt, curr);
    }
    return curr;
  }

  const topStmts = getStatementChildren(rootNode);
  processStatements(topStmts, [entryNode]);

  // Compute reachability via BFS from entry
  const reachableNodes = new Set<CFGNode>();
  const queue: CFGNode[] = [entryNode];
  reachableNodes.add(entryNode);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const succ of cur.successors) {
      if (!reachableNodes.has(succ)) {
        reachableNodes.add(succ);
        queue.push(succ);
      }
    }
  }

  return { entry: entryNode, nodes, reachableNodes };
}
