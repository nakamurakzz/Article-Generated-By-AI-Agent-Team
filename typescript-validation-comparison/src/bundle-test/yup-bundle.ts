// Yup Bundle Size Test - Comprehensive real-world usage
import * as Yup from 'yup';

// Basic validation schemas
export const userSchema = Yup.object({
  id: Yup.string().uuid().required(),
  name: Yup.string().min(1).max(100).required(),
  email: Yup.string().email().required(),
  age: Yup.number().min(18).max(120).required(),
  isActive: Yup.boolean().required(),
  tags: Yup.array().of(Yup.string().required()).required(),
  profile: Yup.object({
    bio: Yup.string().optional(),
    avatar: Yup.string().url().optional(),
    preferences: Yup.object().required(),
  }).required(),
});

export const apiRequestSchema = Yup.object({
  method: Yup.string().oneOf(['GET', 'POST', 'PUT', 'DELETE']).required(),
  path: Yup.string().matches(/^\//).required(),
  headers: Yup.object().required(),
  body: Yup.mixed().optional(),
  query: Yup.object().optional(),
});

export const configSchema = Yup.object({
  database: Yup.object({
    host: Yup.string().required(),
    port: Yup.number().default(5432),
    username: Yup.string().required(),
    password: Yup.string().required(),
    database: Yup.string().required(),
  }).required(),
  cache: Yup.object({
    ttl: Yup.number().default(3600),
    maxSize: Yup.number().default(1000),
  }).required(),
  features: Yup.object({
    enableLogging: Yup.boolean().default(true),
    enableMetrics: Yup.boolean().default(false),
  }).required(),
});

// Advanced schemas for full feature testing
export const recursiveSchema: any = Yup.lazy(() =>
  Yup.object({
    id: Yup.string().required(),
    children: Yup.array().of(recursiveSchema).optional(),
  })
);

// Conditional schema
export const conditionalSchema = Yup.object({
  type: Yup.string().oneOf(['user', 'admin']).required(),
  data: Yup.mixed().when('type', {
    is: 'user',
    then: () => userSchema,
    otherwise: () => Yup.object({
      permissions: Yup.array().of(Yup.string().required()).required(),
    }),
  }),
});

// Transformation examples
export const transformSchema = Yup.object({
  dateString: Yup.string().transform((value) => new Date(value)),
  numberString: Yup.string().transform((value) => Number(value)),
  csvArray: Yup.string().transform((value) => value.split(',')),
});

// Custom validation with test
export const customValidationSchema = Yup.object({
  evenNumber: Yup.number().test(
    'is-even',
    'Number must be even',
    (value) => value !== undefined && value % 2 === 0
  ),
  strongPassword: Yup.string().test(
    'strong-password',
    'Password must be strong',
    (value) => value !== undefined && 
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value)
  ),
});

// Async validation
export const asyncValidationSchema = Yup.object({
  username: Yup.string().test(
    'unique-username',
    'Username must be unique',
    async (value) => {
      // Simulate async check
      await new Promise(resolve => setTimeout(resolve, 10));
      return value !== 'admin';
    }
  ),
});

// Exported validation functions
export async function validateUser(data: unknown) {
  return await userSchema.validate(data);
}

export async function validateRequest(data: unknown) {
  return await apiRequestSchema.validate(data);
}

export async function validateConfig(data: unknown) {
  return await configSchema.validate(data);
}

export async function validateWithTransform(data: unknown) {
  return await transformSchema.validate(data);
}

export async function validateConditional(data: unknown) {
  return await conditionalSchema.validate(data);
}

export async function validateCustom(data: unknown) {
  return await customValidationSchema.validate(data);
}

export async function validateAsync(data: unknown) {
  return await asyncValidationSchema.validate(data);
}

// Type helpers for TypeScript integration
export type UserType = Yup.InferType<typeof userSchema>;
export type ApiRequestType = Yup.InferType<typeof apiRequestSchema>;
export type ConfigType = Yup.InferType<typeof configSchema>;

console.log('Yup bundle loaded with comprehensive feature set');