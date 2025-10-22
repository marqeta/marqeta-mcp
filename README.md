# MCP Server Runtime

This directory contains a pre-built MCP (Model Context Protocol) server ready to interact with Marqeta APIs. The server was generated from OpenAPI specifications and includes all necessary tools and validation.

## How to use marqeta-mcp server

### mcp.json Configuration

```json
{
  "mcpServers": {
    "marqeta": {
      "command": "npx",
      "args": ["-y", "@marqeta/marqeta-mcp"],
      "env": {
        "MARQETA_API_URL": "your-api-url.marqeta.com",
        "MARQETA_USERNAME": "your-username",
        "MARQETA_PASSWORD": "your-password",
        "MARQETA_PROGRAM_SHORT_CODE": "your-program-code" // not required for public sandbox
      }
    }
  }
}
```

**⚠️ For production use:**
1. Start with `MARQETA_SCOPE=read` and only remove when write access is needed
2. Enable human confirmation for all operations in your MCP client
3. Use dedicated service accounts with minimal required permissions
4. Never share production credentials across environments

## 🔧 Environment Variables

### Required
- `MARQETA_API_URL` - Base URL for Marqeta API (e.g., `sandbox-api.marqeta.io`)
- `MARQETA_USERNAME` - API username
- `MARQETA_PASSWORD` - API password
- `MARQETA_PROGRAM_SHORT_CODE` - Program identifier (adds X-Program-Short-Code header). Skip if you are using Marqeta's public sandbox

### Optional
- `MARQETA_SERVICE` - Comma-separated list of services to load (e.g., `users,transactions,disputes,cardtransitions`)
- `MARQETA_SCOPE` - Filter tools by scope: `read` (GET only) or `all` (default: all)

## Available Tools

The MCP server provides **33 tools** across 7 service categories. User service and scope filters to load tools targeted for specific operation. Tools are categorized by:
- **Service**: The API domain (users, cards, transactions, etc.)
- **Scope**: Read (GET operations) or Write (POST/PUT/DELETE operations)

### Tool Summary

| Service | Read Tools | Write Tools | Total |
|---------|------------|-------------|-------|
| Card Products | 2 | 0 | 2 |
| Card Transitions | 2 | 1 | 3 |
| Cards | 5 | 3 | 8 |
| Disputes | 1 | 1 | 2 |
| Transactions | 4 | 0 | 4 |
| Users | 7 | 0 | 7 |
| Velocity Control | 4 | 3 | 7 |
| **Total** | **25** | **8** | **33** |

### Card Products Tools

| Tool Name | Scope | Description |
|-----------|-------|-------------|
| `cardproducts_getCardproducts` | Read | Lists all card products |
| `cardproducts_getCardproductsToken` | Read | Returns a specific card product |

### Card Transitions Tools

| Tool Name | Scope | Description |
|-----------|-------|-------------|
| `cardtransitions_getCardtransitionsCardToken` | Read | Lists all card transitions |
| `cardtransitions_getCardtransitionsToken` | Read | Returns a card transition object |
| `cardtransitions_postCardtransitions` | Write | Creates a card transition object |

### Cards Tools

| Tool Name | Scope | Description |
|-----------|-------|-------------|
| `cards_getCards` | Read | Lists cards by the last 4 digits |
| `cards_getCardsBarcodeBarcode` | Read | Returns a card's metadata |
| `cards_getCardsToken` | Read | Returns a specific card |
| `cards_getCardsTokenShowpan` | Read | Returns a specific card - PAN visible |
| `cards_getCardsUserToken` | Read | Lists all cards for a specific user |
| `cards_postCards` | Write | Creates a card |
| `cards_postCardsGetbypan` | Write | Returns user and card tokens for the specified PAN |
| `cards_putCardsToken` | Write | Updates a specific card |

### Disputes Tools

| Tool Name | Scope | Description |
|-----------|-------|-------------|
| `disputes_listCases` | Read | List dispute cases with filtering options |
| `disputes_createCase` | Write | Create a new fraud dispute case |

### Transactions Tools

| Tool Name | Scope | Description |
|-----------|-------|-------------|
| `transactions_getTransactions` | Read | List transactions |
| `transactions_getTransactionsFundingsourceFundingsourcetoken` | Read | List transactions for a funding account |
| `transactions_getTransactionsToken` | Read | Retrieve transaction |
| `transactions_getTransactionsTokenRelated` | Read | List related transactions |

### Users Tools

| Tool Name | Scope | Description |
|-----------|-------|-------------|
| `users_getUsers` | Read | List users |
| `users_getUsersAuthClientaccesstokenToken` | Read | Retrieve client access token |
| `users_getUsersParenttokenChildren` | Read | List user child accounts |
| `users_getUsersPhonenumberPhonenumber` | Read | Lists all users who match a phone number |
| `users_getUsersToken` | Read | Retrieve user |
| `users_getUsersTokenNotes` | Read | Lists cardholder notes |
| `users_getUsersTokenSsn` | Read | Retrieve user identification number |

### Velocity Control Tools

| Tool Name | Scope | Description |
|-----------|-------|-------------|
| `velocitycontrol_getVelocitycontrols` | Read | List velocity controls |
| `velocitycontrol_getVelocitycontrolsAccountAccountTokenAvailable` | Read | Retrieve velocity control available balances for an account token |
| `velocitycontrol_getVelocitycontrolsToken` | Read | Returns a specific velocity control |
| `velocitycontrol_getVelocitycontrolsUserUsertokenAvailable` | Read | List user velocity control balances |
| `velocitycontrol_deleteVelocitycontrolsToken` | Write | Sets a specific velocity control to inactive to soft delete it |
| `velocitycontrol_postVelocitycontrols` | Write | Create velocity control |
| `velocitycontrol_putVelocitycontrolsToken` | Write | Update velocity control |

### Filtering Tools

You can filter available tools using environment variables:

```bash
# Load only read operations (GET methods)
export MARQETA_SCOPE=read

# Load only specific services
export MARQETA_SERVICE=users,cards,transactions,cardtransitions
```

## ⚠️ Important Security and Safety Notes

### Use Write Operations with Caution
- **Write tools can modify production data**
- **Enable confirmation for write operations** - Always require explicit confirmation before executing write tools
- **Test in sandbox first** - Always validate your workflows in Marqeta's sandbox environment before using production credentials
- **Review operations carefully** - Double-check all parameters and operations before execution

### Security Best Practices
- **Store credentials securely** - Never commit API credentials to version control or expose them in logs
- **Beware of prompt injection** - AI assistants can be manipulated through crafted inputs
- **Limit scope when possible** - Use `MARQETA_SCOPE=read` to disable write operations when they're not needed


## 📚 More Information

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Marqeta API Documentation](https://docs.marqeta.com)

---
Generated with MCP Server Generator