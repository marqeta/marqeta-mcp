import { z } from 'zod';
export class SchemaConverter {
    spec;
    refStack = new Set();
    refCache = new Map();
    constructor(spec) {
        this.spec = spec;
    }
    openApiToJsonSchema(schema) {
        if (!schema)
            return { type: 'object' };
        if ('$ref' in schema) {
            return this.resolveRef(schema.$ref);
        }
        const jsonSchema = {};
        if (schema.type) {
            jsonSchema.type = schema.type;
        }
        if (schema.description) {
            jsonSchema.description = schema.description;
        }
        if (schema.format) {
            jsonSchema.format = schema.format;
        }
        if (schema.enum) {
            jsonSchema.enum = schema.enum;
        }
        if (schema.pattern) {
            jsonSchema.pattern = schema.pattern;
        }
        if (schema.minimum !== undefined) {
            jsonSchema.minimum = schema.minimum;
        }
        if (schema.maximum !== undefined) {
            jsonSchema.maximum = schema.maximum;
        }
        if (schema.minLength !== undefined) {
            jsonSchema.minLength = schema.minLength;
        }
        if (schema.maxLength !== undefined) {
            jsonSchema.maxLength = schema.maxLength;
        }
        if (schema.default !== undefined) {
            jsonSchema.default = schema.default;
        }
        if (schema.type === 'object') {
            if (schema.properties) {
                jsonSchema.properties = {};
                for (const [key, value] of Object.entries(schema.properties)) {
                    jsonSchema.properties[key] = this.openApiToJsonSchema(value);
                }
            }
            if (schema.required) {
                jsonSchema.required = schema.required;
            }
            if (schema.additionalProperties !== undefined) {
                jsonSchema.additionalProperties = schema.additionalProperties === true
                    ? true
                    : this.openApiToJsonSchema(schema.additionalProperties);
            }
        }
        if (schema.type === 'array') {
            if (schema.items) {
                jsonSchema.items = this.openApiToJsonSchema(schema.items);
            }
            if (schema.minItems !== undefined) {
                jsonSchema.minItems = schema.minItems;
            }
            if (schema.maxItems !== undefined) {
                jsonSchema.maxItems = schema.maxItems;
            }
        }
        if (schema.oneOf) {
            jsonSchema.oneOf = schema.oneOf.map((s) => this.openApiToJsonSchema(s));
        }
        if (schema.anyOf) {
            jsonSchema.anyOf = schema.anyOf.map((s) => this.openApiToJsonSchema(s));
        }
        if (schema.allOf) {
            jsonSchema.allOf = schema.allOf.map((s) => this.openApiToJsonSchema(s));
        }
        return jsonSchema;
    }
    resolveRef(ref) {
        // Check for circular reference
        if (this.refStack.has(ref)) {
            // Return a placeholder for circular refs
            return { type: 'object', _circular: true, _ref: ref };
        }
        // Check cache
        if (this.refCache.has(ref)) {
            return this.refCache.get(ref);
        }
        this.refStack.add(ref);
        try {
            const parts = ref.split('/');
            let current = this.spec;
            for (let i = 1; i < parts.length; i++) {
                current = current[parts[i]];
                if (!current) {
                    throw new Error(`Cannot resolve reference: ${ref}`);
                }
            }
            const result = this.openApiToJsonSchema(current);
            this.refCache.set(ref, result);
            return result;
        }
        finally {
            this.refStack.delete(ref);
        }
    }
    jsonSchemaToZod(schema) {
        // Handle circular references
        if (schema?._circular) {
            return z.lazy(() => z.object({}).passthrough());
        }
        // Handle composite schemas first
        if (schema?.oneOf) {
            return this.handleOneOf(schema.oneOf);
        }
        if (schema?.anyOf) {
            return this.handleAnyOf(schema.anyOf);
        }
        if (schema?.allOf) {
            return this.handleAllOf(schema.allOf);
        }
        if (!schema || !schema.type) {
            return z.any();
        }
        switch (schema.type) {
            case 'string':
                let stringSchema = z.string();
                if (schema.description) {
                    stringSchema = stringSchema.describe(schema.description);
                }
                if (schema.minLength) {
                    stringSchema = stringSchema.min(schema.minLength);
                }
                if (schema.maxLength) {
                    stringSchema = stringSchema.max(schema.maxLength);
                }
                if (schema.pattern) {
                    stringSchema = stringSchema.regex(new RegExp(schema.pattern));
                }
                if (schema.format === 'email') {
                    stringSchema = z.string().email();
                }
                else if (schema.format === 'uuid') {
                    stringSchema = z.string().uuid();
                }
                else if (schema.format === 'date-time') {
                    stringSchema = z.string().datetime();
                }
                else if (schema.format === 'date') {
                    stringSchema = z.string().date();
                }
                if (schema.enum) {
                    return z.enum(schema.enum);
                }
                return stringSchema;
            case 'number':
            case 'integer':
                let numberSchema = schema.type === 'integer' ? z.number().int() : z.number();
                if (schema.description) {
                    numberSchema = numberSchema.describe(schema.description);
                }
                if (schema.minimum !== undefined) {
                    numberSchema = numberSchema.min(schema.minimum);
                }
                if (schema.maximum !== undefined) {
                    numberSchema = numberSchema.max(schema.maximum);
                }
                return numberSchema;
            case 'boolean':
                return z.boolean();
            case 'array':
                const itemSchema = schema.items ? this.jsonSchemaToZod(schema.items) : z.any();
                let arraySchema = z.array(itemSchema);
                if (schema.minItems !== undefined) {
                    arraySchema = arraySchema.min(schema.minItems);
                }
                if (schema.maxItems !== undefined) {
                    arraySchema = arraySchema.max(schema.maxItems);
                }
                return arraySchema;
            case 'object':
                if (!schema.properties) {
                    return z.record(z.any());
                }
                const shape = {};
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    let propZod = this.jsonSchemaToZod(propSchema);
                    if (!schema.required || !schema.required.includes(key)) {
                        propZod = propZod.optional();
                    }
                    shape[key] = propZod;
                }
                const objectSchema = z.object(shape);
                // Note: strict() is not compatible with the base type, just return the object
                // The validation will still work correctly
                return objectSchema;
            default:
                return z.any();
        }
    }
    handleOneOf(schemas) {
        if (schemas.length === 0)
            return z.never();
        if (schemas.length === 1)
            return this.jsonSchemaToZod(schemas[0]);
        const zodSchemas = schemas.map(s => this.jsonSchemaToZod(s));
        return z.union(zodSchemas);
    }
    handleAnyOf(schemas) {
        if (schemas.length === 0)
            return z.never();
        if (schemas.length === 1)
            return this.jsonSchemaToZod(schemas[0]);
        const zodSchemas = schemas.map(s => this.jsonSchemaToZod(s));
        return z.union(zodSchemas);
    }
    handleAllOf(schemas) {
        if (schemas.length === 0)
            return z.any();
        if (schemas.length === 1)
            return this.jsonSchemaToZod(schemas[0]);
        // For allOf, we need to merge schemas
        // This is a simplified implementation - could be enhanced
        const zodSchemas = schemas.map(s => this.jsonSchemaToZod(s));
        return z.intersection(zodSchemas[0], zodSchemas.slice(1).reduce((acc, curr) => z.intersection(acc, curr), zodSchemas[0]));
    }
}
//# sourceMappingURL=schema-converter.js.map