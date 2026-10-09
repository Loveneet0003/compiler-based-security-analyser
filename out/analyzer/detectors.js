"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDetectors = runDetectors;
function runDetectors(root, cfg, dataFlow, languageId) {
    const issues = [];
    const reportedCalls = new Set();
    for (const node of cfg.nodes) {
        if (node.isEntry)
            continue;
        const text = node.astNode.text;
        // ========================================================
        // 1. Unreachable Code Detector (CWE-561)
        // ========================================================
        if (!node.isEntry && node.predecessors.length === 0) {
            issues.push({
                ruleId: 'SEC001',
                cwe: 'CWE-561',
                severity: 'MEDIUM',
                message: 'Security Warning: Unreachable code detected. Execution flow will never reach this statement.',
                startPosition: node.astNode.startPosition,
                endPosition: node.astNode.endPosition
            });
        }
        // ========================================================
        // 2. Dataflow Dependent Detectors (Null Pointer & Buffer Bounds)
        // ========================================================
        const state = dataFlow.get(node);
        if (state) {
            for (const [varName, varState] of state.entries()) {
                // --- Detector 2: Null Pointer Dereference (CWE-476) ---
                if (varState.isStaticallyNull) {
                    // Avoid flagging the assignment/initialization statement itself
                    const isAssigningNull = new RegExp(`(?:\\*?\\s*${varName}\\s*=\\s*(?:null|NULL|nullptr|0))`).test(text);
                    if (!isAssigningNull) {
                        // Checks for JS: var.prop, var(), var[idx]
                        // Checks for C/C++: *var, var->prop, var[idx]
                        const derefPatterns = [
                            new RegExp(`\\*\\s*${varName}\\b`), // C pointer dereference: *ptr
                            new RegExp(`\\b${varName}\\s*->`), // C arrow dereference: ptr->field
                            new RegExp(`\\b${varName}\\s*\\.`), // Object member access: obj.field
                            new RegExp(`\\b${varName}\\s*\\(`), // Function invocation: fn()
                            new RegExp(`\\b${varName}\\s*\\[`) // Index dereference: arr[0]
                        ];
                        const isDereferenced = derefPatterns.some(pattern => pattern.test(text));
                        if (isDereferenced) {
                            issues.push({
                                ruleId: 'SEC002',
                                cwe: 'CWE-476',
                                severity: 'CRITICAL',
                                message: `Security Vulnerability: Possible Null Pointer Dereference on '${varName}'.`,
                                startPosition: node.astNode.startPosition,
                                endPosition: node.astNode.endPosition
                            });
                        }
                    }
                }
                // --- Detector 3: Buffer Overflow / Misuse (CWE-119 / CWE-787) ---
                if (varState.isArray && varState.staticSize !== undefined) {
                    const subscripts = node.astNode.descendantsOfType('subscript_expression');
                    for (const sub of subscripts) {
                        const arrName = sub.childForFieldName('argument')?.text ||
                            sub.childForFieldName('object')?.text ||
                            sub.children[0]?.text;
                        if (arrName === varName) {
                            const idxNode = sub.childForFieldName('index') || sub.children[2];
                            if (idxNode) {
                                const idxText = idxNode.text.trim();
                                if (/^-?\d+$/.test(idxText)) {
                                    const index = parseInt(idxText, 10);
                                    if (index >= varState.staticSize || index < 0) {
                                        const reason = index < 0
                                            ? `Negative index ${index} (Buffer Underflow)`
                                            : `Index ${index} is out of bounds for buffer of size ${varState.staticSize}`;
                                        issues.push({
                                            ruleId: 'SEC003',
                                            cwe: 'CWE-119',
                                            severity: 'CRITICAL',
                                            message: `Security Vulnerability: Buffer Bounds Violation. ${reason} on '${varName}'.`,
                                            startPosition: sub.startPosition,
                                            endPosition: sub.endPosition
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // ========================================================
        // 3. Insecure / Dangerous Function Call Detector (CWE-676 / CWE-120 / CWE-95)
        // ========================================================
        const calls = node.astNode.descendantsOfType('call_expression');
        for (const call of calls) {
            if (reportedCalls.has(call.id))
                continue;
            const fnIdent = call.childForFieldName('function') || call.children[0];
            const fnName = fnIdent ? fnIdent.text : '';
            if (fnName === 'gets') {
                reportedCalls.add(call.id);
                issues.push({
                    ruleId: 'SEC004',
                    cwe: 'CWE-242',
                    severity: 'CRITICAL',
                    message: "Use of inherently dangerous function 'gets()'. Buffer overflow cannot be prevented; use 'fgets()' instead.",
                    startPosition: call.startPosition,
                    endPosition: call.endPosition
                });
            }
            else if (fnName === 'strcpy') {
                reportedCalls.add(call.id);
                issues.push({
                    ruleId: 'SEC004',
                    cwe: 'CWE-120',
                    severity: 'HIGH',
                    message: "Use of unbounded string copy function 'strcpy()'. Potential buffer overflow; consider 'strncpy()' or 'strlcpy()'.",
                    startPosition: call.startPosition,
                    endPosition: call.endPosition
                });
            }
            else if (fnName === 'strcat') {
                reportedCalls.add(call.id);
                issues.push({
                    ruleId: 'SEC004',
                    cwe: 'CWE-120',
                    severity: 'HIGH',
                    message: "Use of unbounded string concatenation function 'strcat()'. Potential buffer overflow; consider 'strncat()'.",
                    startPosition: call.startPosition,
                    endPosition: call.endPosition
                });
            }
            else if (fnName === 'sprintf') {
                reportedCalls.add(call.id);
                issues.push({
                    ruleId: 'SEC004',
                    cwe: 'CWE-120',
                    severity: 'HIGH',
                    message: "Potential buffer overflow via unbounded 'sprintf()'. Use 'snprintf()' with explicit length bounds.",
                    startPosition: call.startPosition,
                    endPosition: call.endPosition
                });
            }
            else if (fnName === 'eval') {
                reportedCalls.add(call.id);
                issues.push({
                    ruleId: 'SEC004',
                    cwe: 'CWE-95',
                    severity: 'CRITICAL',
                    message: "Dangerous dynamic code execution via 'eval()'. Susceptible to arbitrary code execution / injection.",
                    startPosition: call.startPosition,
                    endPosition: call.endPosition
                });
            }
        }
    }
    return issues;
}
//# sourceMappingURL=detectors.js.map