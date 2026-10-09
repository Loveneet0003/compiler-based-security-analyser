"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCFG = buildCFG;
/**
 * Control Flow Graph (CFG) builder.
 * Traverses the AST, models basic blocks and branch control flow (if/else),
 * captures early exits (return, throw), and computes reachability from entry.
 */
function buildCFG(rootNode) {
    const nodes = [];
    let idCounter = 0;
    function createNode(astNode, isEntry = false, isExit = false) {
        const node = {
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
    function connect(from, to) {
        if (!from.successors.includes(to)) {
            from.successors.push(to);
        }
        if (!to.predecessors.includes(from)) {
            to.predecessors.push(from);
        }
    }
    function connectAll(fromNodes, toNode) {
        for (const from of fromNodes) {
            connect(from, toNode);
        }
    }
    function getStatementChildren(node) {
        return node.children.filter(child => {
            const type = child.type;
            return type !== '{' && type !== '}' && type !== ';' && type !== 'comment';
        });
    }
    function processNode(node, incoming) {
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
            let consequenceExits = [];
            if (consequence) {
                consequenceExits = processNode(consequence, [ifNode]);
            }
            else {
                consequenceExits = [ifNode];
            }
            let alternativeExits = [];
            if (alternative) {
                const altBody = alternative.type === 'else_clause'
                    ? (alternative.children.find(c => c.type !== 'else' && c.type !== 'comment') || alternative)
                    : alternative;
                alternativeExits = processNode(altBody, [ifNode]);
                return [...consequenceExits, ...alternativeExits];
            }
            else {
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
    function processStatements(stmts, incoming) {
        let curr = incoming;
        for (const stmt of stmts) {
            curr = processNode(stmt, curr);
        }
        return curr;
    }
    const topStmts = getStatementChildren(rootNode);
    processStatements(topStmts, [entryNode]);
    // Compute reachability via BFS from entry
    const reachableNodes = new Set();
    const queue = [entryNode];
    reachableNodes.add(entryNode);
    while (queue.length > 0) {
        const cur = queue.shift();
        for (const succ of cur.successors) {
            if (!reachableNodes.has(succ)) {
                reachableNodes.add(succ);
                queue.push(succ);
            }
        }
    }
    return { entry: entryNode, nodes, reachableNodes };
}
//# sourceMappingURL=cfg.js.map