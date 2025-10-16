# MCP Server Runtime

This directory contains a pre-built MCP (Model Context Protocol) server ready to run. The server was generated from OpenAPI specifications and includes all necessary tools and validation.

## 📁 Directory Contents

- `dist/` - Compiled JavaScript files and `tools.json` with all MCP tools
- `package.json` - Node.js package configuration
- `Dockerfile` - Docker configuration for containerized deployment

## 🚀 Quick Start

### Option 1: Run Locally with Node.js

```bash
# Set required environment variables
export MARQETA_API_URL=your-api-url.marqeta.io
export MARQETA_USERNAME=your_username
export MARQETA_PASSWORD=your_password

# Optional environment variables
export MARQETA_PROGRAM_SHORT_CODE=your_program  # Program identifier
export MARQETA_SERVICE=service1,service2        # Filter by services
export MARQETA_SCOPE=read                       # read-only mode

# Run the server
node dist/src/index.js
```

### Option 2: Run with Docker

#### Build the Docker image:
```bash
docker build -t marqeta-mcp-server .
```

#### Run the container:
```bash
docker run -it --rm \
  -e MARQETA_API_URL=your-api-url.marqeta.io \
  -e MARQETA_USERNAME=your_username \
  -e MARQETA_PASSWORD=your_password \
  -e MARQETA_PROGRAM_SHORT_CODE=your_program \
  marqeta-mcp-server
```

## 🔧 Environment Variables

### Required
- `MARQETA_API_URL` - Base URL for Marqeta API (e.g., `sandbox-api.marqeta.io`)
- `MARQETA_USERNAME` - API username
- `MARQETA_PASSWORD` - API password

### Optional
- `MARQETA_PROGRAM_SHORT_CODE` - Program identifier (adds X-Program-Short-Code header)
- `MARQETA_SERVICE` - Comma-separated list of services to load (e.g., `user-management,transactions`)
- `MARQETA_SCOPE` - Filter tools by scope: `read` (GET only) or `all` (default: all)

## 🔌 MCP Client Configuration

#### Local Node.js Configuration:
```json
{
  "mcpServers": {
    "marqeta": {
      "command": "node",
      "args": ["/absolute/path/to/this/directory/dist/src/index.js"],
      "env": {
        "MARQETA_API_URL": "your-api-url.marqeta.io",
        "MARQETA_USERNAME": "your_username",
        "MARQETA_PASSWORD": "your_password",
        "MARQETA_PROGRAM_SHORT_CODE": "your_program"
      }
    }
  }
}
```

#### Docker Configuration:
```json
{
  "mcpServers": {
    "marqeta": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MARQETA_API_URL=your-api-url.marqeta.io",
        "-e", "MARQETA_USERNAME=your_username",
        "-e", "MARQETA_PASSWORD=your_password",
        "-e", "MARQETA_PROGRAM_SHORT_CODE=your_program",
        "-e", "MARQETA_SERVICE=user-management,transactions",
        "-e", "MARQETA_SCOPE=read",
        "marqeta-mcp-server"
      ]
    }
  }
}
```

## 📋 Available Tools

To see what tools are available, check the `dist/tools.json` file:

```bash
# List all tool names
cat dist/tools.json | grep '"name"' | cut -d'"' -f4

# Count tools by scope
echo "Read tools: $(grep '"scope": "read"' dist/tools.json | wc -l)"
echo "Write tools: $(grep '"scope": "write"' dist/tools.json | wc -l)"
```

## 🧪 Testing the Server

### Test locally:
```bash
# The server expects MCP protocol messages via stdio
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  MARQETA_API_URL=your-api.marqeta.io \
  MARQETA_USERNAME=your_username \
  MARQETA_PASSWORD=your_password \
  node dist/src/index.js
```

### Test Docker image:
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  docker run -i --rm \
    -e MARQETA_API_URL=your-api.marqeta.io \
    -e MARQETA_USERNAME=your_username \
    -e MARQETA_PASSWORD=your_password \
    marqeta-mcp-server
```

## 🛠️ Troubleshooting

### Server won't start
- Ensure all required environment variables are set
- Check that `node_modules` exists (run `npm ci --only=production` if missing)
- Verify Node.js version: `node --version` (requires v20+)

### Authentication errors
- Verify API credentials are correct
- Check API URL format (should not include `https://`)
- Ensure program short code matches your API access

### Filtering tools
- Use `MARQETA_SERVICE` to load only specific services
- Use `MARQETA_SCOPE=read` to load only read operations (GET endpoints)
- Multiple services: `MARQETA_SERVICE=service1,service2,service3`

## 📚 More Information

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Marqeta API Documentation](https://docs.marqeta.com)

---
Generated with MCP Server Generator