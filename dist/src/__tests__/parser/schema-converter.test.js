import { describe, it, expect, beforeEach } from '@jest/globals';
import { SchemaConverter } from '../../parser/schema-converter.js';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe('SchemaConverter', () => {
    let converter;
    let mockSpec;
    beforeEach(async () => {
        // Load test schema from file
        const schemaPath = path.join(__dirname, '..', 'fixtures', 'test-schema.yaml');
        const schemaContent = await fs.readFile(schemaPath, 'utf8');
        mockSpec = yaml.load(schemaContent);
        converter = new SchemaConverter(mockSpec);
    });
    describe('openApiToJsonSchema', () => {
        it('should handle null or undefined schemas', () => {
            const result = converter.openApiToJsonSchema(null);
            expect(result).toEqual({ type: 'object' });
            const result2 = converter.openApiToJsonSchema(undefined);
            expect(result2).toEqual({ type: 'object' });
        });
        it('should convert string types with constraints', () => {
            const schema = {
                type: 'string',
                minLength: 5,
                maxLength: 20,
                pattern: '^[a-z]+$',
                description: 'Test string'
            };
            const result = converter.openApiToJsonSchema(schema);
            expect(result).toEqual({
                type: 'string',
                minLength: 5,
                maxLength: 20,
                pattern: '^[a-z]+$',
                description: 'Test string'
            });
        });
        it('should convert string formats', () => {
            const emailSchema = { type: 'string', format: 'email' };
            const uuidSchema = { type: 'string', format: 'uuid' };
            const dateSchema = { type: 'string', format: 'date' };
            const dateTimeSchema = { type: 'string', format: 'date-time' };
            expect(converter.openApiToJsonSchema(emailSchema)).toEqual({
                type: 'string',
                format: 'email'
            });
            expect(converter.openApiToJsonSchema(uuidSchema)).toEqual({
                type: 'string',
                format: 'uuid'
            });
            expect(converter.openApiToJsonSchema(dateSchema)).toEqual({
                type: 'string',
                format: 'date'
            });
            expect(converter.openApiToJsonSchema(dateTimeSchema)).toEqual({
                type: 'string',
                format: 'date-time'
            });
        });
        it('should convert number and integer types with constraints', () => {
            const numberSchema = {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Test number'
            };
            const integerSchema = {
                type: 'integer',
                minimum: 1,
                maximum: 10
            };
            expect(converter.openApiToJsonSchema(numberSchema)).toEqual({
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Test number'
            });
            expect(converter.openApiToJsonSchema(integerSchema)).toEqual({
                type: 'integer',
                minimum: 1,
                maximum: 10
            });
        });
        it('should convert enum values', () => {
            const schema = {
                type: 'string',
                enum: ['red', 'green', 'blue']
            };
            const result = converter.openApiToJsonSchema(schema);
            expect(result).toEqual({
                type: 'string',
                enum: ['red', 'green', 'blue']
            });
        });
        it('should convert array types with constraints', () => {
            const schema = {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 5
            };
            const result = converter.openApiToJsonSchema(schema);
            expect(result).toEqual({
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 5
            });
        });
        it('should convert object types with properties', () => {
            const schemaWithFalse = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer' }
                },
                required: ['name'],
                additionalProperties: false
            };
            const resultWithFalse = converter.openApiToJsonSchema(schemaWithFalse);
            // When additionalProperties is false, it gets converted to an object schema
            expect(resultWithFalse.additionalProperties).toEqual({ type: 'object' });
            const schemaWithTrue = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                },
                additionalProperties: true
            };
            const resultWithTrue = converter.openApiToJsonSchema(schemaWithTrue);
            expect(resultWithTrue.additionalProperties).toBe(true);
            const schemaWithSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                },
                additionalProperties: { type: 'string' }
            };
            const resultWithSchema = converter.openApiToJsonSchema(schemaWithSchema);
            expect(resultWithSchema.additionalProperties).toEqual({ type: 'string' });
        });
        it('should handle $ref resolution from loaded schema', () => {
            const schema = { '$ref': '#/components/schemas/User' };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.type).toBe('object');
            expect(result.properties).toBeDefined();
            expect(result.properties.id).toEqual({ type: 'string', format: 'uuid' });
            expect(result.properties.name).toEqual({ type: 'string', minLength: 1, maxLength: 100 });
            expect(result.properties.email).toEqual({ type: 'string', format: 'email' });
            expect(result.properties.age).toEqual({ type: 'integer', minimum: 0, maximum: 150 });
            expect(result.properties.isActive).toEqual({ type: 'boolean' });
            expect(result.required).toEqual(['id', 'name', 'email']);
        });
        it('should handle nested $ref resolution', () => {
            const schema = { '$ref': '#/components/schemas/Product' };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.properties.category.type).toBe('object');
            expect(result.properties.category.properties).toBeDefined();
            expect(result.properties.category.properties.id).toEqual({ type: 'string' });
            expect(result.properties.category.properties.name).toEqual({ type: 'string' });
        });
        it('should handle enum $ref resolution', () => {
            const schema = { '$ref': '#/components/schemas/Status' };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.type).toBe('string');
            expect(result.enum).toEqual(['active', 'inactive', 'pending']);
        });
        it('should throw error for invalid $ref', () => {
            const schema = { '$ref': '#/components/schemas/NonExistent' };
            expect(() => converter.openApiToJsonSchema(schema)).toThrow('Cannot resolve reference');
        });
        it('should handle oneOf schemas', () => {
            const schema = {
                oneOf: [
                    { type: 'string' },
                    { type: 'number' }
                ]
            };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.oneOf).toHaveLength(2);
            expect(result.oneOf[0]).toEqual({ type: 'string' });
            expect(result.oneOf[1]).toEqual({ type: 'number' });
        });
        it('should handle anyOf schemas', () => {
            const schema = {
                anyOf: [
                    { type: 'string' },
                    { type: 'null' }
                ]
            };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.anyOf).toHaveLength(2);
        });
        it('should handle allOf schemas', () => {
            const schema = {
                allOf: [
                    { type: 'object', properties: { id: { type: 'string' } } },
                    { type: 'object', properties: { name: { type: 'string' } } }
                ]
            };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.allOf).toHaveLength(2);
        });
        it('should preserve default values', () => {
            const schema = {
                type: 'string',
                default: 'default-value'
            };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.default).toBe('default-value');
        });
        it('should handle array properties from loaded schema', () => {
            const schema = { '$ref': '#/components/schemas/User' };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.properties.tags).toBeDefined();
            expect(result.properties.tags.type).toBe('array');
            expect(result.properties.tags.items).toEqual({ type: 'string' });
            expect(result.properties.tags.minItems).toBe(0);
            expect(result.properties.tags.maxItems).toBe(10);
        });
        it('should handle additionalProperties from loaded schema', () => {
            const schema = { '$ref': '#/components/schemas/User' };
            const result = converter.openApiToJsonSchema(schema);
            expect(result.properties.metadata).toBeDefined();
            expect(result.properties.metadata.type).toBe('object');
            expect(result.properties.metadata.additionalProperties).toEqual({ type: 'string' });
        });
    });
    describe('jsonSchemaToZod', () => {
        it('should handle schemas without type', () => {
            const result = converter.jsonSchemaToZod({});
            expect(result).toBeInstanceOf(z.ZodAny);
            const result2 = converter.jsonSchemaToZod(null);
            expect(result2).toBeInstanceOf(z.ZodAny);
        });
        it('should convert string schemas to Zod', () => {
            const schema = {
                type: 'string',
                minLength: 5,
                maxLength: 20,
                pattern: '^[a-z]+$',
                description: 'Test string'
            };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(zodSchema).toBeInstanceOf(z.ZodString);
            expect(() => zodSchema.parse('abcde')).not.toThrow();
            expect(() => zodSchema.parse('abc')).toThrow(); // Too short
            expect(() => zodSchema.parse('a'.repeat(21))).toThrow(); // Too long
            expect(() => zodSchema.parse('ABC123')).toThrow(); // Doesn't match pattern
        });
        it('should convert string format schemas', () => {
            const emailSchema = converter.jsonSchemaToZod({ type: 'string', format: 'email' });
            const uuidSchema = converter.jsonSchemaToZod({ type: 'string', format: 'uuid' });
            const dateTimeSchema = converter.jsonSchemaToZod({ type: 'string', format: 'date-time' });
            const dateSchema = converter.jsonSchemaToZod({ type: 'string', format: 'date' });
            expect(() => emailSchema.parse('test@example.com')).not.toThrow();
            expect(() => emailSchema.parse('invalid-email')).toThrow();
            expect(() => uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
            expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
            expect(() => dateTimeSchema.parse('2023-01-01T00:00:00Z')).not.toThrow();
            expect(() => dateSchema.parse('2023-01-01')).not.toThrow();
        });
        it('should convert enum schemas', () => {
            const schema = {
                type: 'string',
                enum: ['red', 'green', 'blue']
            };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(() => zodSchema.parse('red')).not.toThrow();
            expect(() => zodSchema.parse('green')).not.toThrow();
            expect(() => zodSchema.parse('yellow')).toThrow();
        });
        it('should convert number and integer schemas', () => {
            const numberSchema = converter.jsonSchemaToZod({
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Test number'
            });
            const integerSchema = converter.jsonSchemaToZod({
                type: 'integer',
                minimum: 1,
                maximum: 10
            });
            expect(() => numberSchema.parse(50.5)).not.toThrow();
            expect(() => numberSchema.parse(-1)).toThrow();
            expect(() => numberSchema.parse(101)).toThrow();
            expect(() => integerSchema.parse(5)).not.toThrow();
            expect(() => integerSchema.parse(5.5)).toThrow(); // Not an integer
            expect(() => integerSchema.parse(0)).toThrow(); // Below minimum
        });
        it('should convert boolean schemas', () => {
            const zodSchema = converter.jsonSchemaToZod({ type: 'boolean' });
            expect(zodSchema).toBeInstanceOf(z.ZodBoolean);
            expect(() => zodSchema.parse(true)).not.toThrow();
            expect(() => zodSchema.parse(false)).not.toThrow();
            expect(() => zodSchema.parse('true')).toThrow();
        });
        it('should convert array schemas', () => {
            const schema = {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 3
            };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(() => zodSchema.parse(['a', 'b'])).not.toThrow();
            expect(() => zodSchema.parse([])).toThrow(); // Too few items
            expect(() => zodSchema.parse(['a', 'b', 'c', 'd'])).toThrow(); // Too many items
            expect(() => zodSchema.parse(['a', 1])).toThrow(); // Wrong item type
        });
        it('should convert object schemas with required fields', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer' },
                    email: { type: 'string', format: 'email' }
                },
                required: ['name', 'email']
            };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(() => zodSchema.parse({
                name: 'John',
                email: 'john@example.com'
            })).not.toThrow();
            expect(() => zodSchema.parse({
                name: 'John',
                age: 30,
                email: 'john@example.com'
            })).not.toThrow();
            expect(() => zodSchema.parse({
                age: 30,
                email: 'john@example.com'
            })).toThrow(); // Missing required 'name'
        });
        it('should handle objects without properties', () => {
            const schema = { type: 'object' };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(() => zodSchema.parse({})).not.toThrow();
            expect(() => zodSchema.parse({ any: 'property' })).not.toThrow();
        });
        it('should handle unknown types as z.any()', () => {
            const schema = { type: 'unknown-type' };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(zodSchema).toBeInstanceOf(z.ZodAny);
            expect(() => zodSchema.parse('anything')).not.toThrow();
        });
        it('should convert oneOf schemas to Zod unions', () => {
            const schema = {
                oneOf: [
                    { type: 'string' },
                    { type: 'number' }
                ]
            };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(() => zodSchema.parse('test')).not.toThrow();
            expect(() => zodSchema.parse(123)).not.toThrow();
            expect(() => zodSchema.parse(true)).toThrow();
        });
        it('should convert anyOf schemas to Zod unions', () => {
            const schema = {
                anyOf: [
                    { type: 'string', minLength: 5 },
                    { type: 'number', minimum: 10 }
                ]
            };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(() => zodSchema.parse('hello')).not.toThrow();
            expect(() => zodSchema.parse(15)).not.toThrow();
            expect(() => zodSchema.parse('hi')).toThrow(); // too short
            expect(() => zodSchema.parse(5)).toThrow(); // too small
        });
        it('should handle allOf schemas', () => {
            const schema = {
                allOf: [
                    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
                    { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
                ]
            };
            const zodSchema = converter.jsonSchemaToZod(schema);
            expect(() => zodSchema.parse({ id: '123', name: 'test' })).not.toThrow();
            expect(() => zodSchema.parse({ id: '123' })).toThrow(); // missing name
            expect(() => zodSchema.parse({ name: 'test' })).toThrow(); // missing id
        });
        it('should handle circular references gracefully', () => {
            const circularSchema = {
                type: 'object',
                _circular: true,
                _ref: '#/components/schemas/Circular'
            };
            const zodSchema = converter.jsonSchemaToZod(circularSchema);
            expect(() => zodSchema.parse({})).not.toThrow();
            expect(() => zodSchema.parse({ any: 'property' })).not.toThrow();
        });
        it('should convert schema from loaded file', () => {
            // First convert the User schema reference to JSON Schema
            const userJsonSchema = converter.openApiToJsonSchema({ '$ref': '#/components/schemas/User' });
            // Then convert to Zod
            const zodSchema = converter.jsonSchemaToZod(userJsonSchema);
            // Test valid user object
            const validUser = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'John Doe',
                email: 'john@example.com',
                age: 30,
                isActive: true,
                tags: ['developer', 'admin'],
                metadata: {
                    role: 'admin',
                    department: 'IT'
                }
            };
            expect(() => zodSchema.parse(validUser)).not.toThrow();
            // Test missing required field
            const invalidUser = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'John Doe'
                // missing email
            };
            expect(() => zodSchema.parse(invalidUser)).toThrow();
            // Test invalid age
            const userWithInvalidAge = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'John Doe',
                email: 'john@example.com',
                age: 200 // exceeds maximum
            };
            expect(() => zodSchema.parse(userWithInvalidAge)).toThrow();
        });
    });
});
//# sourceMappingURL=schema-converter.test.js.map