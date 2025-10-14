#!/usr/bin/env node

/**
 * Executable wrapper for Marqeta MCP Server
 * This allows the server to be run via npx or as a global command
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the actual MCP server
const serverPath = join(__dirname, '..', 'dist', 'src', 'index.js');

// Pass through all environment variables and arguments
const child = spawn('node', [serverPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

// Forward exit codes
child.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle errors
child.on('error', (error) => {
  console.error('Failed to start Marqeta MCP server:', error);
  process.exit(1);
});