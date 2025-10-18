import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RateLimiter } from '../../client/rate-limiter.js';
describe('RateLimiter', () => {
    let originalEnv;
    beforeEach(() => {
        // Save original environment
        originalEnv = { ...process.env };
        // Clear rate limiting environment variables
        delete process.env.MARQETA_RATE_LIMIT_ENABLED;
        delete process.env.MARQETA_RATE_LIMIT_INTERVAL_MS;
        delete process.env.MARQETA_MAX_CONCURRENT_REQUESTS;
        delete process.env.MARQETA_RATE_LIMIT_QUEUE_SIZE;
    });
    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });
    describe('Configuration', () => {
        it('should use default configuration when no config provided', () => {
            const limiter = new RateLimiter();
            const status = limiter.getStatus();
            expect(status.enabled).toBe(true);
            expect(status.config.intervalMs).toBe(500);
            expect(status.config.maxConcurrent).toBe(2);
            expect(status.config.maxQueueSize).toBe(10);
        });
        it('should use environment variables for configuration', () => {
            process.env.MARQETA_RATE_LIMIT_INTERVAL_MS = '1000';
            process.env.MARQETA_MAX_CONCURRENT_REQUESTS = '3';
            process.env.MARQETA_RATE_LIMIT_QUEUE_SIZE = '50';
            const limiter = new RateLimiter();
            const status = limiter.getStatus();
            expect(status.config.intervalMs).toBe(1000);
            expect(status.config.maxConcurrent).toBe(3);
            expect(status.config.maxQueueSize).toBe(50);
        });
        it('should override environment with constructor config', () => {
            process.env.MARQETA_RATE_LIMIT_INTERVAL_MS = '1000';
            const limiter = new RateLimiter({ intervalMs: 2000 });
            const status = limiter.getStatus();
            expect(status.config.intervalMs).toBe(2000);
        });
        it('should disable rate limiting when configured', () => {
            process.env.MARQETA_RATE_LIMIT_ENABLED = 'false';
            const limiter = new RateLimiter();
            const status = limiter.getStatus();
            expect(status.enabled).toBe(false);
        });
        it('should throw error for invalid configuration', () => {
            expect(() => new RateLimiter({ intervalMs: -1 }))
                .toThrow('Rate limit interval must be non-negative');
            expect(() => new RateLimiter({ maxConcurrent: 0 }))
                .toThrow('Max concurrent requests must be at least 1');
            expect(() => new RateLimiter({ maxQueueSize: -1 }))
                .toThrow('Max queue size must be non-negative');
        });
    });
    describe('Rate Limiting', () => {
        it('should execute immediately when rate limiting disabled', async () => {
            const limiter = new RateLimiter({ enabled: false });
            const startTime = Date.now();
            const result = await limiter.execute(() => Promise.resolve('test'));
            const elapsed = Date.now() - startTime;
            expect(result).toBe('test');
            expect(elapsed).toBeLessThan(50); // Should be nearly instant
        });
        it('should enforce interval between requests', async () => {
            const limiter = new RateLimiter({ intervalMs: 100, maxConcurrent: 1 });
            const startTime = Date.now();
            // Execute two requests
            const promise1 = limiter.execute(() => Promise.resolve('first'));
            const promise2 = limiter.execute(() => Promise.resolve('second'));
            const results = await Promise.all([promise1, promise2]);
            const elapsed = Date.now() - startTime;
            expect(results).toEqual(['first', 'second']);
            expect(elapsed).toBeGreaterThanOrEqual(100); // Second request should wait
        });
        it('should limit concurrent requests', async () => {
            const limiter = new RateLimiter({
                intervalMs: 10,
                maxConcurrent: 2
            });
            let concurrent = 0;
            let maxConcurrent = 0;
            const makeRequest = async (id) => {
                return limiter.execute(async () => {
                    concurrent++;
                    maxConcurrent = Math.max(maxConcurrent, concurrent);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    concurrent--;
                    return id;
                });
            };
            // Start 4 requests
            const promises = [
                makeRequest(1),
                makeRequest(2),
                makeRequest(3),
                makeRequest(4)
            ];
            await Promise.all(promises);
            // Should never exceed 2 concurrent requests
            expect(maxConcurrent).toBeLessThanOrEqual(2);
        });
    });
    describe('Queue Management', () => {
        it('should queue requests when rate limited', async () => {
            const limiter = new RateLimiter({
                intervalMs: 50,
                maxConcurrent: 1,
                maxQueueSize: 10
            });
            const results = [];
            const promises = [];
            // Queue multiple requests
            for (let i = 0; i < 5; i++) {
                promises.push(limiter.execute(async () => {
                    results.push(i);
                    return i;
                }));
            }
            const values = await Promise.all(promises);
            expect(values).toEqual([0, 1, 2, 3, 4]);
            expect(results).toEqual([0, 1, 2, 3, 4]); // Should execute in order
        });
        it('should reject when queue is full', async () => {
            const limiter = new RateLimiter({
                intervalMs: 100,
                maxConcurrent: 1,
                maxQueueSize: 1 // Small queue that fills quickly
            });
            // Start a slow request that blocks processing
            const promise1 = limiter.execute(() => new Promise(resolve => setTimeout(() => resolve('1'), 200)));
            // Wait a tiny bit to ensure first request is processing
            await new Promise(resolve => setTimeout(resolve, 5));
            // Add second request to queue (fills the queue to maxQueueSize = 1)
            const promise2 = limiter.execute(() => Promise.resolve('2'));
            // This should be rejected (queue is full with 1 item)
            await expect(limiter.execute(() => Promise.resolve('3')))
                .rejects.toThrow('Rate limit queue is full');
            // Clean up
            await Promise.all([promise1, promise2]);
        });
        it('should provide retry information when queue is full', async () => {
            const limiter = new RateLimiter({
                intervalMs: 100,
                maxConcurrent: 1,
                maxQueueSize: 1
            });
            // Start slow request that blocks processing
            const promise1 = limiter.execute(() => new Promise(resolve => setTimeout(resolve, 200)));
            // Wait a bit to ensure first request is processing
            await new Promise(resolve => setTimeout(resolve, 5));
            // Fill the queue
            const promise2 = limiter.execute(() => Promise.resolve('queued'));
            try {
                await limiter.execute(() => Promise.resolve('rejected'));
                fail('Should have thrown error');
            }
            catch (error) {
                expect(error.name).toBe('RateLimitQueueFullError');
                expect(error.retryAfter).toBeGreaterThan(0);
                expect(error.queueLength).toBe(1);
                expect(error.maxQueueSize).toBe(1);
            }
            // Clean up
            await Promise.all([promise1, promise2]);
        });
        it('should clear queue when requested', () => {
            const limiter = new RateLimiter({
                intervalMs: 10000, // Very long interval
                maxConcurrent: 1,
                maxQueueSize: 10
            });
            // Queue some requests
            const promise1 = limiter.execute(() => Promise.resolve('1'));
            const promise2 = limiter.execute(() => Promise.resolve('2'));
            const promise3 = limiter.execute(() => Promise.resolve('3'));
            // Clear the queue
            limiter.clearQueue();
            // These should all reject
            return Promise.all([
                expect(promise1).rejects.toThrow('Queue cleared'),
                expect(promise2).rejects.toThrow('Queue cleared'),
                expect(promise3).rejects.toThrow('Queue cleared')
            ]);
        });
    });
    describe('Error Handling', () => {
        it('should propagate errors from executed functions', async () => {
            const limiter = new RateLimiter();
            await expect(limiter.execute(() => Promise.reject(new Error('Test error'))))
                .rejects.toThrow('Test error');
        });
        it('should handle non-Error rejections', async () => {
            const limiter = new RateLimiter();
            await expect(limiter.execute(() => Promise.reject('String error')))
                .rejects.toThrow('String error');
        });
    });
    describe('Status Monitoring', () => {
        it('should provide accurate status information', async () => {
            const limiter = new RateLimiter({
                intervalMs: 50,
                maxConcurrent: 1,
                maxQueueSize: 5
            });
            let status = limiter.getStatus();
            expect(status.queueLength).toBe(0);
            expect(status.concurrentRequests).toBe(0);
            // Start a slow request that will block and be processing
            const promise1 = limiter.execute(() => new Promise(resolve => setTimeout(() => resolve('1'), 200)));
            // Queue additional requests (these will be in the queue)
            const promise2 = limiter.execute(() => Promise.resolve('2'));
            const promise3 = limiter.execute(() => Promise.resolve('3'));
            // Give a moment for the first to start processing
            await new Promise(resolve => setTimeout(resolve, 10));
            status = limiter.getStatus();
            // First request is being processed (removed from queue), others are queued
            expect(status.queueLength).toBe(2); // promise2 and promise3 are queued
            expect(status.concurrentRequests).toBe(1); // promise1 is processing
            // Clean up
            await Promise.all([promise1, promise2, promise3]);
        });
    });
});
//# sourceMappingURL=rate-limiter.test.js.map