const fs = require('fs');
const path = require('path');
const { AnalyzerEngine } = require('./out/analyzer/index.js');

async function main() {
    const wasmPath = path.join(__dirname, 'wasm');
    const analyzer = new AnalyzerEngine(wasmPath);
    await analyzer.init();

    const target = process.argv[2];
    
    if (target) {
        const fullPath = path.resolve(target);
        if (fs.statSync(fullPath).isDirectory()) {
            await analyzeDirectory(analyzer, fullPath);
        } else {
            await analyzeFile(analyzer, fullPath);
        }
    } else {
        // analyze all files in test/ by default
        const testDir = path.join(__dirname, 'test');
        await analyzeDirectory(analyzer, testDir);
    }
}

async function analyzeDirectory(analyzer, dirPath) {
    const files = fs.readdirSync(dirPath).filter(f => f.match(/\.(js|ts|c|cpp)$/));
    for (const file of files) {
        await analyzeFile(analyzer, path.join(dirPath, file));
        console.log("\n");
    }
}

async function analyzeFile(analyzer, filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    
    let languageId = 'javascript';
    if (ext === '.c') languageId = 'c';
    if (ext === '.cpp') languageId = 'cpp';
    if (ext === '.ts') languageId = 'typescript';

    console.log(`--- Analyzing ${path.relative(__dirname, filePath)} (${languageId}) ---`);
    const issues = await analyzer.analyze(code, languageId);
    
    if (issues.length === 0) {
        console.log("No issues found or analysis failed.");
    }

    issues.forEach(issue => {
        console.log(`[${issue.ruleId}] ${issue.message}`);
        console.log(`  Line: ${issue.startPosition.row + 1}`);
    });
}

main().catch(console.error);
