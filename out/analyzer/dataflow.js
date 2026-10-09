"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDataFlow = runDataFlow;
/**
 * Data Flow Analyzer.
 * Tracks variable assignments (null states, buffer allocations, reassignments)
 * across statements in the CFG.
 */
function runDataFlow(cfg) {
    const state = new Map();
    const globalVarState = new Map();
    for (const node of cfg.nodes) {
        if (node.isEntry)
            continue;
        const text = node.astNode.text;
        // Capture state before statement executes (inState)
        state.set(node, new Map(globalVarState));
        // 1. Matches null assignments across JS/TS and C/C++:
        // JS: "let x = null", "const user = null"
        // C/C++: "int *ptr = NULL", "char *p = 0", "p = NULL", "p = nullptr"
        const nullAssignMatch = text.match(/(?:let|var|const|[a-zA-Z0-9_]+)?\s*\*?\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*(?:null|NULL|nullptr|0)\s*(?:;|$)/);
        if (nullAssignMatch) {
            const varName = nullAssignMatch[1];
            if (!['return', 'if', 'else', 'while', 'for'].includes(varName)) {
                globalVarState.set(varName, { isStaticallyNull: true, isArray: false });
            }
        }
        // 2. Matches buffer / array allocation:
        // JS: "let buf = new Array(10)" or "new Int8Array(32)"
        const jsArrayMatch = text.match(/(?:let|var|const)?\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*new\s+(?:Array|Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array|Buffer)\s*\(\s*(\d+)\s*\)/);
        // C/C++: "char buf[10]", "int numbers[5]", "unsigned int arr[20]"
        const cArrayMatch = text.match(/(?:(?:unsigned|signed|const|static)\s+)*(?:int|char|float|double|short|long|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\[\s*(\d+)\s*\]/);
        if (jsArrayMatch) {
            const varName = jsArrayMatch[1];
            const size = parseInt(jsArrayMatch[2], 10);
            globalVarState.set(varName, { isStaticallyNull: false, isArray: true, staticSize: size });
        }
        else if (cArrayMatch) {
            const varName = cArrayMatch[1];
            const size = parseInt(cArrayMatch[2], 10);
            globalVarState.set(varName, { isStaticallyNull: false, isArray: true, staticSize: size });
        }
        // 3. Reset null state if reassigned to a non-null expression (e.g. ptr = malloc(...) or x = 5)
        // Avoid matching *ptr = 42 which is a dereference write, not a pointer reassignment
        const reassignmentMatch = text.match(/^\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*([^;]+)/);
        if (reassignmentMatch && !nullAssignMatch && !jsArrayMatch && !cArrayMatch) {
            const varName = reassignmentMatch[1];
            const rhs = reassignmentMatch[2].trim();
            if (!rhs.match(/^(?:null|NULL|nullptr|0)$/)) {
                const v = globalVarState.get(varName);
                if (v) {
                    v.isStaticallyNull = false;
                }
            }
        }
    }
    return state;
}
//# sourceMappingURL=dataflow.js.map