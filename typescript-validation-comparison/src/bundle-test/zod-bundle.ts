// Zod Bundle Size Test - Comprehensive real-world usage
import { z } from 'zod';

// Basic validation schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(18).max(120),
  isActive: z.boolean(),
  tags: z.array(z.string()),
  profile: z.object({
    bio: z.string().optional(),
    avatar: z.string().url().optional(),
    preferences: z.record(z.any()),
  }),
});

export const apiRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  path: z.string().startsWith('/'),
  headers: z.record(z.string()),
  body: z.any().optional(),
  query: z.record(z.string()).optional(),
});

export const configSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number().default(5432),
    username: z.string(),
    password: z.string(),
    database: z.string(),
  }),
  cache: z.object({
    ttl: z.number().default(3600),
    maxSize: z.number().default(1000),
  }),
  features: z.object({
    enableLogging: z.boolean().default(true),
    enableMetrics: z.boolean().default(false),
  }),
});

// Advanced schemas for full feature testing
export const recursiveSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    children: z.array(recursiveSchema).optional(),
  })
);

export const unionSchema = z.union([
  z.object({ type: z.literal('user'), data: userSchema }),
  z.object({ type: z.literal('config'), data: configSchema }),
]);

// Transformation and refinement examples
export const transformSchema = z.object({
  dateString: z.string().transform(str => new Date(str)),
  numberString: z.string().transform(Number),
  csvArray: z.string().transform(str => str.split(',')),
});

export const refinedSchema = z.object({
  evenNumber: z.number().refine(n => n % 2 === 0, 'Must be even'),
  strongPassword: z.string().refine(
    str => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(str),
    'Password must be strong'
  ),
});

// Exported validation functions
export function validateUser(data: unknown) {
  return userSchema.parse(data);
}

export function validateRequest(data: unknown) {
  return apiRequestSchema.parse(data);
}

export function validateConfig(data: unknown) {
  return configSchema.parse(data);
}

export function validateWithTransform(data: unknown) {
  return transformSchema.parse(data);
}

// Type exports for TypeScript integration
export type User = z.infer<typeof userSchema>;
export type ApiRequest = z.infer<typeof apiRequestSchema>;
export type Config = z.infer<typeof configSchema>;

console.log('Zod bundle loaded with comprehensive feature set');