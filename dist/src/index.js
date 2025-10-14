import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { HttpClient } from './client/http-client.js';
import { SchemaConverter } from './parser/schema-converter.js';
import 'dotenv/config';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class MarqetaMcpServer {
    config;
    httpClient;
    precompiledTools = [];
    filteredTools = [];
    toolsPath;
    constructor(deps = {}) {
        this.config = deps.config || this.loadConfig();
        this.validateConfig();
        this.httpClient = deps.httpClient || new HttpClient(this.config.baseUrl, this.config.username, this.config.password, this.config.programShortCode);
        this.toolsPath = deps.toolsPath || path.join(__dirname, '..', 'tools.json');
    }
    loadConfig() {
        return {
            baseUrl: process.env.MARQETA_API_URL || '',
            username: process.env.MARQETA_USERNAME || '',
            password: process.env.MARQETA_PASSWORD || '',
            programShortCode: process.env.MARQETA_PROGRAM_SHORT_CODE || undefined,
            service: process.env.MARQETA_SERVICE || undefined,
            scope: (process.env.MARQETA_SCOPE || 'all')
        };
    }
    validateConfig() {
        if (!this.config.baseUrl) {
            throw new Error('MARQETA_API_URL is required');
        }
        if (!this.config.username) {
            throw new Error('MARQETA_USERNAME is required');
        }
        if (!this.config.password) {
            throw new Error('MARQETA_PASSWORD is required');
        }
    }
    async loadTools() {
        try {
            const toolsContent = await fs.readFile(this.toolsPath, 'utf8');
            this.precompiledTools = JSON.parse(toolsContent);
            //console.log(`Loaded ${this.precompiledTools.length} precompiled tools`);
        }
        catch (error) {
            console.error('Error loading tools.json:', error);
            console.error('Make sure to run "npm run build" first to generate tools');
            throw error;
        }
        this.filteredTools = this.filterTools();
        //console.log(`Filtered to ${this.filteredTools.length} tools based on configuration`);
    }
    getFilteredTools() {
        return this.filteredTools;
    }
    getConfig() {
        return this.config;
    }
    filterTools() {
        let filtered = [...this.precompiledTools];
        if (this.config.scope === 'read') {
            filtered = filtered.filter(t => t.scope === 'read');
        }
        if (this.config.service) {
            const services = this.config.service.split(',').map(s => s.trim());
            filtered = filtered.filter(t => services.includes(t.service));
        }
        return filtered;
    }
    createToolHandler(tool) {
        return async (params) => {
            try {
                const converter = new SchemaConverter({});
                const inputValidator = converter.jsonSchemaToZod(tool.inputSchema);
                let validatedInput;
                try {
                    validatedInput = inputValidator.parse(params.arguments || {});
                }
                catch (error) {
                    if (error instanceof z.ZodError) {
                        return {
                            content: [{
                                    type: 'text',
                                    text: `Input validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                                }]
                        };
                    }
                    throw error;
                }
                const response = await this.httpClient.executeToolRequest(tool, validatedInput);
                const outputValidator = converter.jsonSchemaToZod(tool.outputSchema);
                let validatedOutput;
                try {
                    validatedOutput = outputValidator.parse(response);
                }
                catch (error) {
                    console.error('Output validation warning:', error);
                    validatedOutput = response;
                }
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(validatedOutput, null, 2)
                        }]
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                            type: 'text',
                            text: `Error: ${errorMessage}`
                        }]
                };
            }
        };
    }
    async setupServer() {
        await this.loadTools();
        const server = new Server({
            name: 'marqeta-mcp-server',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        // Handle list tools request
        server.setRequestHandler(z.object({
            method: z.literal('tools/list')
        }), async () => {
            return {
                tools: this.filteredTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                }))
            };
        });
        // Handle tool call request
        server.setRequestHandler(z.object({
            method: z.literal('tools/call'),
            params: z.object({
                name: z.string(),
                arguments: z.any()
            })
        }), async (request) => {
            const { name, arguments: args } = request.params;
            const tool = this.filteredTools.find(t => t.name === name);
            if (!tool) {
                throw new Error(`Tool not found: ${name}`);
            }
            const handler = this.createToolHandler(tool);
            return handler({ arguments: args });
        });
        return server;
    }
    async start() {
        const server = await this.setupServer();
        const transport = new StdioServerTransport();
        await server.connect(transport);
        //console.log('Marqeta MCP Server started successfully');
    }
}
// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    async function main() {
        try {
            const server = new MarqetaMcpServer();
            await server.start();
        }
        catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map