import axios from 'axios';
import { RateLimiter } from './rate-limiter.js';
// Version for client identification (update when releasing new versions)
const VERSION = '1.0.0';
export class HttpClient {
    axios;
    rateLimiter;
    constructor(baseUrl, username, password, programShortCode, rateLimiterConfig) {
        if (!baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }
        const headers = {
            'User-Agent': `mcp-server/${VERSION}`,
            'X-Marqeta-Client': `mcp-server/${VERSION}`,
            'X-Marqeta-Request-Source': 'mcp-request'
        };
        if (programShortCode) {
            headers['X-Program-Short-Code'] = programShortCode;
        }
        this.axios = axios.create({
            baseURL: baseUrl,
            auth: {
                username,
                password
            },
            headers,
            timeout: 30000,
            validateStatus: (status) => status < 500
        });
        // Initialize rate limiter with config or defaults from environment
        this.rateLimiter = new RateLimiter(rateLimiterConfig);
    }
    async executeToolRequest(tool, params) {
        let url = tool.http.path;
        const queryParams = {};
        const headers = {};
        let requestBody = undefined;
        if (tool.http.parameters?.path) {
            for (const [key, paramDef] of Object.entries(tool.http.parameters.path)) {
                const value = params[key];
                if (value === undefined && paramDef.required) {
                    throw new Error(`Required path parameter '${key}' is missing`);
                }
                if (value !== undefined) {
                    url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
                }
            }
        }
        if (tool.http.parameters?.query) {
            for (const [key, paramDef] of Object.entries(tool.http.parameters.query)) {
                const value = params[key];
                if (value === undefined && paramDef.required) {
                    throw new Error(`Required query parameter '${key}' is missing`);
                }
                if (value !== undefined) {
                    queryParams[key] = value;
                }
            }
        }
        if (tool.http.parameters?.header) {
            for (const [key, paramDef] of Object.entries(tool.http.parameters.header)) {
                const value = params[key];
                if (value === undefined && paramDef.required) {
                    throw new Error(`Required header parameter '${key}' is missing`);
                }
                if (value !== undefined) {
                    headers[paramDef.name] = String(value);
                }
            }
        }
        if (tool.http.requestBody) {
            requestBody = {};
            const bodySchema = tool.http.requestBody.schema;
            if (bodySchema.type === 'object' && bodySchema.properties) {
                for (const prop of Object.keys(bodySchema.properties)) {
                    if (params[prop] !== undefined) {
                        requestBody[prop] = params[prop];
                    }
                }
            }
            else {
                const bodyParams = { ...params };
                if (tool.http.parameters) {
                    for (const paramType of ['path', 'query', 'header']) {
                        const params = tool.http.parameters[paramType];
                        if (params) {
                            for (const key of Object.keys(params)) {
                                delete bodyParams[key];
                            }
                        }
                    }
                }
                requestBody = bodyParams;
            }
            if (tool.http.requestBody.contentType) {
                headers['Content-Type'] = tool.http.requestBody.contentType;
            }
        }
        const config = {
            method: tool.http.method,
            url,
            params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
            data: requestBody,
            headers: Object.keys(headers).length > 0 ? headers : undefined
        };
        // Execute request with rate limiting
        return this.rateLimiter.execute(async () => {
            try {
                const response = await this.axios.request(config);
                if (response.status >= 400) {
                    throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(response.data)}`);
                }
                return response.data;
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    const message = error.response?.data?.message || error.response?.data || error.message;
                    throw new Error(`HTTP request failed: ${message}`);
                }
                throw error;
            }
        });
    }
}
//# sourceMappingURL=http-client.js.map