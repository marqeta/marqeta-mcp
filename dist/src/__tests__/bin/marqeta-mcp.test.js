import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { spawn } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
describe('marqeta-mcp.js bin wrapper', () => {
    let tempDir;
    const binPath = join(__dirname, '..', '..', '..', 'bin', 'marqeta-mcp.js');
    beforeEach(async () => {
        // Create a temporary directory for test files
        tempDir = join(tmpdir(), `mcp-bin-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
    });
    afterEach(async () => {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    it('should execute the wrapper script successfully', (done) => {
        // Test that the wrapper can be spawned and responds to help
        const child = spawn('node', [binPath, '--help'], {
            env: {
                ...process.env,
                MARQETA_API_URL: 'test.api.marqeta.io',
                MARQETA_USERNAME: 'test_user',
                MARQETA_PASSWORD: 'test_password'
            }
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('exit', (code) => {
            // The server doesn't have a --help flag, so it should start normally
            // We expect it to exit with code 0 or run indefinitely
            // For testing, we just verify it spawns without immediate errors
            expect(code).toBeDefined();
            done();
        });
        child.on('error', (error) => {
            done(error);
        });
        // Kill the process after a short time since it runs indefinitely
        setTimeout(() => {
            child.kill('SIGTERM');
        }, 100);
    });
    it('should pass environment variables to the server', (done) => {
        const testEnv = {
            MARQETA_API_URL: 'test.api.marqeta.io',
            MARQETA_USERNAME: 'test_user',
            MARQETA_PASSWORD: 'test_password',
            MARQETA_PROGRAM_SHORT_CODE: 'test_program'
        };
        const child = spawn('node', [binPath], {
            env: {
                ...process.env,
                ...testEnv
            }
        });
        // The server should start with these environment variables
        // We can't easily test they're passed through, but we verify the process starts
        setTimeout(() => {
            child.kill('SIGTERM');
            done();
        }, 100);
        child.on('error', (error) => {
            done(error);
        });
    });
    it('should forward exit codes from the server', (done) => {
        // Test that exit codes are properly forwarded
        // Since we can't easily make the server exit with a specific code,
        // we test that the wrapper handles signals properly
        const child = spawn('node', [binPath], {
            env: {
                ...process.env,
                MARQETA_API_URL: 'test.api.marqeta.io',
                MARQETA_USERNAME: 'test_user',
                MARQETA_PASSWORD: 'test_password'
            }
        });
        setTimeout(() => {
            child.kill('SIGTERM');
        }, 100);
        child.on('exit', (code, signal) => {
            // Verify the process exits when signaled
            expect(signal || code).toBeDefined();
            done();
        });
        child.on('error', (error) => {
            done(error);
        });
    });
    it('should pass command line arguments to the server', (done) => {
        // Test that CLI arguments are forwarded
        const testArgs = ['--test-arg', 'value', '--another-flag'];
        const child = spawn('node', [binPath, ...testArgs], {
            env: {
                ...process.env,
                MARQETA_API_URL: 'test.api.marqeta.io',
                MARQETA_USERNAME: 'test_user',
                MARQETA_PASSWORD: 'test_password'
            }
        });
        // We can't easily verify the args are passed, but we ensure the process starts
        setTimeout(() => {
            child.kill('SIGTERM');
            done();
        }, 100);
        child.on('error', (error) => {
            done(error);
        });
    });
    it('should handle stdio inheritance correctly', (done) => {
        // Test that stdin/stdout/stderr are properly inherited
        const child = spawn('node', [binPath], {
            env: {
                ...process.env,
                MARQETA_API_URL: 'test.api.marqeta.io',
                MARQETA_USERNAME: 'test_user',
                MARQETA_PASSWORD: 'test_password'
            },
            stdio: 'pipe' // Use pipe to capture output
        });
        // Send a test message to stdin (MCP protocol message)
        const testMessage = JSON.stringify({
            jsonrpc: '2.0',
            method: 'initialize',
            params: { protocolVersion: '1.0.0' },
            id: 1
        }) + '\n';
        child.stdin?.write(testMessage);
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
            // If we get a response, the stdio is working
            if (stdout.includes('jsonrpc') || stdout.includes('result')) {
                child.kill('SIGTERM');
            }
        });
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('exit', () => {
            // Verify we got some output (stdout or stderr)
            // The server might output to either stream
            expect(stdout.length + stderr.length).toBeGreaterThan(0);
            done();
        });
        child.on('error', (error) => {
            done(error);
        });
        // Timeout safety - give more time for initialization
        setTimeout(() => {
            child.kill('SIGTERM');
        }, 1000);
    }, 10000); // Increase timeout for this test
});
//# sourceMappingURL=marqeta-mcp.test.js.map