/**
 * Vulnerable C Test File
 * Intentionally designed with security flaws to test the Compiler-Assisted Security Analyzer.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void process_request(int flag) {
    printf("Starting request processing...\n");

    // ==========================================
    // Vulnerability 1: Null Pointer Dereference (CWE-476)
    // ==========================================
    int *ptr = NULL;
    *ptr = 42; // Dereference of NULL pointer!

    // ==========================================
    // Vulnerability 2: Buffer Overflow (CWE-119)
    // ==========================================
    char local_buffer[10];
    local_buffer[15] = 'Z'; // Out of bounds write (size 10, index 15)

    int scores[5];
    scores[10] = 99; // Out of bounds write (size 5, index 10)

    // Underflow access
    scores[-1] = 0; // Negative index access

    // ==========================================
    // Vulnerability 3: Dangerous / Insecure Functions (CWE-242 / CWE-120)
    // ==========================================
    char user_input[32];
    gets(user_input); // Inherently insecure: gets() does not check boundary limits

    char dest[16];
    strcpy(dest, "This string is much longer than the destination buffer capacity"); // Unbounded memory copy

    // ==========================================
    // Vulnerability 4: Unreachable Code (CWE-561)
    // ==========================================
    if (flag > 0) {
        return;
    } else {
        return;
    }

    // Dead code - control flow can never reach here
    printf("This statement is completely unreachable.\n");
    free(ptr);
}

int main() {
    process_request(1);
    return 0;
}
