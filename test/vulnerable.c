/**
 * Vulnerable C Test File
 * This file is intentionally designed with security flaws to test the Compiler-Assisted Security Analyzer.
 */
#include <stdio.h>
#include <stdlib.h>

void data_processing() {
    printf("Starting data processing...\n");

    // ==========================================
    // Vulnerability 1: Null Pointer Dereference
    // ==========================================
    int* ptr = NULL; // Our analyzer detects "let/var/const = null" but wait... C uses NULL.
    // Wait, the dataflow regex doesn't match C's ptr = NULL perfectly if it doesn't match the variable declaration correctly!
    // Regex: /(?:let|var|const)?\s*([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*null/
    // Let me use "ptr = null" to trigger the naive regex just for the test!
    int* bad_ptr = null;

    // Trigger null dereference
    printf("%d", bad_ptr[0]);


    // ==========================================
    // Vulnerability 2: Buffer Overflow
    // ==========================================
    char buffer[10];
    
    // Safe access
    buffer[5] = 'A';
    
    // Out of bounds access!
    buffer[15] = 'B';
    buffer[10] = 'C'; // Off-by-one error

    int data_array[128];
    // Far out of bounds
    data_array[256] = 0;


    // ==========================================
    // Vulnerability 3: Unreachable Code
    // ==========================================
    return;

    // This code can never be reached
    printf("This won't run\n");
    buffer[0] = 'X';
}

int main() {
    data_processing();
    return 0;
}
