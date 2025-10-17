/**
 * Rate limiter for API requests with configurable limits
 * - Maximum 1 API call per configured interval (default 500ms)
 * - Maximum concurrent requests (default 2)
 * - Configurable queue size with overflow handling
 */
export class RateLimiter {
    enabled;
    intervalMs;
    maxConcurrent;
    maxQueueSize;
    lastRequestTime = 0;
    concurrentRequests = 0;
    requestQueue = [];
    processing = false;
    constructor(config = {}) {
        // Load from environment variables with defaults
        this.enabled = config.enabled ??
            (process.env.MARQETA_RATE_LIMIT_ENABLED !== 'false');
        this.intervalMs = config.intervalMs ??
            parseInt(process.env.MARQETA_RATE_LIMIT_INTERVAL_MS || '500', 10);
        this.maxConcurrent = config.maxConcurrent ??
            parseInt(process.env.MARQETA_MAX_CONCURRENT_REQUESTS || '2', 10);
        this.maxQueueSize = config.maxQueueSize ??
            parseInt(process.env.MARQETA_RATE_LIMIT_QUEUE_SIZE || '10', 10);
        // Validate configuration
        if (this.intervalMs < 0) {
            throw new Error('Rate limit interval must be non-negative');
        }
        if (this.maxConcurrent < 1) {
            throw new Error('Max concurrent requests must be at least 1');
        }
        if (this.maxQueueSize < 0) {
            throw new Error('Max queue size must be non-negative');
        }
    }
    /**
     * Execute a function with rate limiting
     */
    async execute(fn) {
        // Skip rate limiting if disabled
        if (!this.enabled) {
            return fn();
        }
        return new Promise((resolve, reject) => {
            // Check queue capacity
            if (this.requestQueue.length >= this.maxQueueSize) {
                const error = this.createQueueFullError();
                reject(error);
                return;
            }
            // Add to queue
            this.requestQueue.push({
                execute: fn,
                resolve,
                reject,
                timestamp: Date.now()
            });
            // Process queue if not already processing
            if (!this.processing) {
                this.processQueue();
            }
        });
    }
    /**
     * Process queued requests respecting rate limits
     */
    async processQueue() {
        this.processing = true;
        while (this.requestQueue.length > 0) {
            // Wait for rate limit window
            await this.waitForRateLimit();
            // Wait for concurrency limit
            await this.waitForConcurrencySlot();
            // Get next request from queue
            const request = this.requestQueue.shift();
            if (!request)
                continue;
            // Track concurrent request
            this.concurrentRequests++;
            this.lastRequestTime = Date.now();
            // Execute request
            this.executeRequest(request).finally(() => {
                this.concurrentRequests--;
            });
        }
        this.processing = false;
    }
    /**
     * Execute a single request
     */
    async executeRequest(request) {
        try {
            const result = await request.execute();
            request.resolve(result);
        }
        catch (error) {
            request.reject(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Wait until rate limit window has passed
     */
    async waitForRateLimit() {
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        const waitTime = this.intervalMs - timeSinceLastRequest;
        if (waitTime > 0) {
            await this.sleep(waitTime);
        }
    }
    /**
     * Wait for a concurrency slot to become available
     */
    async waitForConcurrencySlot() {
        while (this.concurrentRequests >= this.maxConcurrent) {
            await this.sleep(50); // Check every 50ms
        }
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Create error for queue full condition
     */
    createQueueFullError() {
        const waitTime = this.estimatedWaitTime();
        const error = new Error(`Rate limit queue is full (${this.requestQueue.length}/${this.maxQueueSize}). ` +
            `Please retry after ${waitTime}ms`);
        error.name = 'RateLimitQueueFullError';
        error.retryAfter = waitTime;
        error.queueLength = this.requestQueue.length;
        error.maxQueueSize = this.maxQueueSize;
        return error;
    }
    /**
     * Estimate wait time for queue to clear
     */
    estimatedWaitTime() {
        // Calculate based on queue size and rate limit
        const concurrencyFactor = Math.ceil(this.requestQueue.length / this.maxConcurrent);
        return Math.max(concurrencyFactor * this.intervalMs, this.intervalMs);
    }
    /**
     * Get current queue status (for monitoring/debugging)
     */
    getStatus() {
        return {
            enabled: this.enabled,
            queueLength: this.requestQueue.length,
            concurrentRequests: this.concurrentRequests,
            config: {
                intervalMs: this.intervalMs,
                maxConcurrent: this.maxConcurrent,
                maxQueueSize: this.maxQueueSize
            }
        };
    }
    /**
     * Clear the queue (for cleanup/testing)
     */
    clearQueue() {
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            if (request) {
                request.reject(new Error('Queue cleared'));
            }
        }
    }
}
//# sourceMappingURL=rate-limiter.js.map