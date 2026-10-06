"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCFG = buildCFG;
/**
 * A simplified CFG builder that walks the AST.
 * In a real-world multi-language scenario, this would map language-specific
 * AST nodes (like JavaScript's 'if_statement' vs C's 'if_statement')
 * into generic IR nodes. For this proof-of-concept, we'll build a linear
 * sequence and add basic branching heuristics.
 */
function buildCFG(rootNode) {
    const nodes = [];
    let idCounter = 0;
    const entryNode = {
        id: idCounter++,
        astNode: rootNode,
        successors: [],
        predecessors: [],
        isEntry: true,
        isExit: false
    };
    nodes.push(entryNode);
    let currentNode = entryNode;
    // A very basic pre-order traversal simulating a linear CFG with rudimentary branching
    function traverse(node) {
        // Treat statements as basic blocks, but NOT functions or blocks
        const isBasicBlock = (node.type.includes('statement') || node.type.includes('declaration') || node.type === 'return_statement')
            && !node.type.includes('function')
            && !node.type.includes('class')
            && !node.type.includes('block');
        if (isBasicBlock) {
            const newNode = {
                id: idCounter++,
                astNode: node,
                successors: [],
                predecessors: [],
                isEntry: false,
                isExit: node.type === 'return_statement'
            };
            // Basic linear linking (unless it's unreachable in our heuristic)
            if (!currentNode.isExit) {
                currentNode.successors.push(newNode);
                newNode.predecessors.push(currentNode);
                currentNode = newNode;
            }
            nodes.push(newNode);
            return; // Do not traverse children of statements as separate CFG nodes for this simple heuristic
        }
        // Heuristics for branching (e.g., if statements)
        // Note: A true CFG would link the true/false branches and merge them.
        // For this generic demo, we are just mapping nodes.
        for (const child of node.children) {
            traverse(child);
        }
    }
    for (const child of rootNode.children) {
        traverse(child);
    }
    return { entry: entryNode, nodes };
}
//# sourceMappingURL=cfg.js.map