#!/usr/bin/env node

/**
 * Compiler-Assisted Security Analyzer CLI
 * Professional CLI with ANSI colored diagnostic reports, source line previews,
 * severity metrics, and OASIS SARIF v2.1.0 output for CI/CD pipelines.
 */

const fs = require('fs');
const path = require('path');
const { AnalyzerEngine } = require('./out/analyzer/index.js');

// ANSI Terminal Colors (Zero External Dependencies)
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m\x1b[37m\x1b[1m',
    bgYellow: '\x1b[43m\x1b[30m\x1b[1m',
    bgBlue: '\x1b[44m\x1b[37m\x1b[1m',
    bgGreen: '\x1b[42m\x1b[30m\x1b[1m'
};

function severityBadge(sev) {
    switch (sev) {
        case 'CRITICAL':
            return `${C.bgRed} CRITICAL ${C.reset}`;
        case 'HIGH':
            return `${C.red}${C.bold} HIGH ${C.reset}`;
        case 'MEDIUM':
            return `${C.yellow}${C.bold} MEDIUM ${C.reset}`;
        case 'LOW':
            return `${C.blue}${C.bold} LOW ${C.reset}`;
        default:
            return `${C.dim} INFO ${C.reset}`;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const formatSarif = args.includes('--sarif') || args.includes('--format=sarif');
    const formatJson = args.includes('--json') || args.includes('--format=json');
    const exitZero = args.includes('--exit-zero');
    
    // Filter out options to get target path
    const nonFlags = args.filter(a => !a.startsWith('--'));
    const target = nonFlags[0];

    const wasmPath = path.join(__dirname, 'wasm');
    const analyzer = new AnalyzerEngine(wasmPath);
    await analyzer.init();

    if (!formatSarif && !formatJson) {
        console.log(`\n${C.bold}${C.cyan}======================================================================${C.reset}`);
        console.log(`${C.bold}${C.white}   Compiler-Assisted Security Analyzer (Static CST & Dataflow)        ${C.reset}`);
        console.log(`${C.bold}${C.cyan}======================================================================${C.reset}\n`);
    }

    const fileList = [];

    if (target) {
        const fullPath = path.resolve(target);
        if (!fs.existsSync(fullPath)) {
            console.error(`${C.red}Error: Path not found: ${fullPath}${C.reset}`);
            process.exit(1);
        }
        if (fs.statSync(fullPath).isDirectory()) {
            collectFiles(fullPath, fileList);
        } else {
            fileList.push(fullPath);
        }
    } else {
        const testDir = path.join(__dirname, 'test');
        collectFiles(testDir, fileList);
    }

    const allResults = [];
    const stats = {
        files: fileList.length,
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    };

    for (const file of fileList) {
        const result = await analyzeFile(analyzer, file, { formatSarif, formatJson });
        allResults.push(result);

        stats.totalIssues += result.issues.length;
        for (const iss of result.issues) {
            if (iss.severity === 'CRITICAL') stats.critical++;
            else if (iss.severity === 'HIGH') stats.high++;
            else if (iss.severity === 'MEDIUM') stats.medium++;
            else if (iss.severity === 'LOW') stats.low++;
        }
    }

    // Output formatting
    if (formatSarif) {
        const sarif = generateSarif(allResults);
        const sarifPath = path.join(process.cwd(), 'security-report.sarif');
        fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2), 'utf8');
        console.log(JSON.stringify(sarif, null, 2));
    } else if (formatJson) {
        console.log(JSON.stringify({ stats, results: allResults }, null, 2));
    } else {
        // Pretty Summary Banner
        console.log(`\n${C.bold}${C.white}------------------------- SCAN SUMMARY -------------------------${C.reset}`);
        console.log(`  ${C.bold}Files Analyzed:${C.reset}    ${stats.files}`);
        console.log(`  ${C.bold}Total Issues:${C.reset}      ${stats.totalIssues === 0 ? `${C.green}0 (Clean)` : `${C.red}${stats.totalIssues}`}${C.reset}`);
        if (stats.totalIssues > 0) {
            console.log(`    ${C.red}• Critical:${C.reset}     ${stats.critical}`);
            console.log(`    ${C.magenta}• High:${C.reset}         ${stats.high}`);
            console.log(`    ${C.yellow}• Medium:${C.reset}       ${stats.medium}`);
            console.log(`    ${C.blue}• Low:${C.reset}          ${stats.low}`);
        }
        console.log(`${C.bold}${C.white}----------------------------------------------------------------${C.reset}\n`);
    }

    if (!exitZero && (stats.critical > 0 || stats.high > 0)) {
        process.exitCode = 1;
    }
}

function collectFiles(dirPath, fileList) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dirPath, ent.name);
        if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== '.git') {
            collectFiles(full, fileList);
        } else if (ent.isFile() && ent.name.match(/\.(js|ts|c|cpp)$/)) {
            fileList.push(full);
        }
    }
}

async function analyzeFile(analyzer, filePath, { formatSarif, formatJson }) {
    const code = fs.readFileSync(filePath, 'utf8');
    const lines = code.split('\n');
    const ext = path.extname(filePath).toLowerCase();
    
    let languageId = 'javascript';
    if (ext === '.c') languageId = 'c';
    if (ext === '.cpp') languageId = 'cpp';
    if (ext === '.ts') languageId = 'typescript';

    const relPath = path.relative(process.cwd(), filePath);
    const issues = await analyzer.analyze(code, languageId);

    if (!formatSarif && !formatJson) {
        const statusSymbol = issues.length === 0 ? `${C.green}✔` : `${C.red}✖`;
        console.log(`${statusSymbol} ${C.bold}${relPath}${C.reset} ${C.dim}(${languageId})${C.reset}`);

        if (issues.length === 0) {
            console.log(`  ${C.dim}No security vulnerabilities identified.${C.reset}\n`);
        } else {
            for (const issue of issues) {
                const row = issue.startPosition.row;
                const col = issue.startPosition.column;
                const lineNum = row + 1;
                const badge = severityBadge(issue.severity);

                console.log(`  ${badge} ${C.bold}${issue.ruleId}${C.reset} [${C.magenta}${issue.cwe || 'CWE-Unknown'}${C.reset}] ${issue.message}`);
                console.log(`  ${C.dim}--> ${relPath}:${lineNum}:${col + 1}${C.reset}`);

                // Code snippet preview
                if (lines[row] !== undefined) {
                    const snippet = lines[row];
                    console.log(`  ${C.dim}${lineNum.toString().padStart(4, ' ')} |${C.reset} ${snippet}`);
                    const indent = ' '.repeat(col);
                    console.log(`  ${C.dim}     |${C.reset} ${indent}${C.red}^--- [Vulnerability Point]${C.reset}`);
                }
                console.log('');
            }
        }
    }

    return { filePath: relPath, languageId, issues };
}

function generateSarif(results) {
    return {
        $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        version: "2.1.0",
        runs: [
            {
                tool: {
                    driver: {
                        name: "CompilerAssistedSecurityAnalyzer",
                        version: "1.0.0",
                        informationUri: "https://github.com/Loveneet0003/compiler-based-security-analyser",
                        rules: [
                            {
                                id: "SEC001",
                                name: "UnreachableCode",
                                shortDescription: { text: "Dead / Unreachable Code Detected" },
                                defaultConfiguration: { level: "warning" },
                                properties: { cwe: "CWE-561" }
                            },
                            {
                                id: "SEC002",
                                name: "NullPointerDereference",
                                shortDescription: { text: "Null Pointer Dereference" },
                                defaultConfiguration: { level: "error" },
                                properties: { cwe: "CWE-476" }
                            },
                            {
                                id: "SEC003",
                                name: "BufferOverflow",
                                shortDescription: { text: "Buffer Bounds Violation / Overflow" },
                                defaultConfiguration: { level: "error" },
                                properties: { cwe: "CWE-119" }
                            },
                            {
                                id: "SEC004",
                                name: "InsecureFunctionCall",
                                shortDescription: { text: "Use of Inherently Dangerous Function" },
                                defaultConfiguration: { level: "error" },
                                properties: { cwe: "CWE-676" }
                            }
                        ]
                    }
                },
                results: results.flatMap(r => r.issues.map(iss => ({
                    ruleId: iss.ruleId,
                    level: (iss.severity === 'CRITICAL' || iss.severity === 'HIGH') ? "error" : "warning",
                    message: { text: iss.message },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { uri: r.filePath },
                                region: {
                                    startLine: iss.startPosition.row + 1,
                                    startColumn: iss.startPosition.column + 1,
                                    endLine: iss.endPosition.row + 1,
                                    endColumn: iss.endPosition.column + 1
                                }
                            }
                        }
                    ]
                })))
            }
        ]
    };
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
