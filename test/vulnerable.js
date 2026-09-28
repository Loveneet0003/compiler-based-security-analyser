/**
 * Vulnerable JavaScript Test File
 * This file is intentionally designed with security flaws to test the Compiler-Assisted Security Analyzer.
 */

function processUserData(req) {
    console.log("Starting user data processing...");

    // ==========================================
    // Vulnerability 1: Null Pointer Dereference
    // ==========================================
    let currentUser = null;
    
    // The analyzer should catch this since currentUser is statically null
    let userName = currentUser.name; 
    console.log("User name is:", userName);

    let config = null;
    // Another null dereference via function call syntax
    config(); 


    // ==========================================
    // Vulnerability 2: Buffer Overflow / Misuse
    // ==========================================
    let dataBuffer = new Array(10);
    
    // Safe access
    dataBuffer[5] = 100;
    
    // Out of bounds access!
    dataBuffer[15] = 200; 
    
    let typedBuffer = new Int8Array(32);
    // Boundary condition overflow
    typedBuffer[32] = 0; 
    // Far out of bounds
    typedBuffer[999] = 1;


    // ==========================================
    // Vulnerability 3: Unreachable Code
    // ==========================================
    if (req.isValid) {
        console.log("Request is valid");
        return true;
    } else {
        console.log("Request is invalid");
        return false;
    }

    // This code can never be reached
    console.log("Executing post-processing steps...");
    cleanUpResources();
}

function secondaryProcess() {
    let session = null;
    // Array index access on null
    let token = session[0];
    
    let queue = new Array(5);
    // Underflow access (out of bounds)
    queue[-1] = 5;

    throw new Error("Fatal failure");

    // Unreachable after throw
    let cleanup = new Array(10);
    cleanup[0] = 1;
}

module.exports = { processUserData, secondaryProcess };
