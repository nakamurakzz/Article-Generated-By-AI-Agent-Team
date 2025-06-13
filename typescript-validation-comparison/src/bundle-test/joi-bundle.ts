// Joi Bundle Size Test - Comprehensive real-world usage
import Joi from 'joi';

// Basic validation schemas
export const userSchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  age: Joi.number().min(18).max(120).required(),
  isActive: Joi.boolean().required(),
  tags: Joi.array().items(Joi.string()).required(),
  profile: Joi.object({
    bio: Joi.string().optional(),
    avatar: Joi.string().uri().optional(),
    preferences: Joi.object().required(),
  }).required(),
});

export const apiRequestSchema = Joi.object({
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE').required(),
  path: Joi.string().pattern(/^\//).required(),
  headers: Joi.object().required(),
  body: Joi.any().optional(),
  query: Joi.object().optional(),
});

export const configSchema = Joi.object({
  database: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().default(5432),
    username: Joi.string().required(),
    password: Joi.string().required(),
    database: Joi.string().required(),
  }).required(),
  cache: Joi.object({
    ttl: Joi.number().default(3600),
    maxSize: Joi.number().default(1000),
  }).required(),
  features: Joi.object({
    enableLogging: Joi.boolean().default(true),
    enableMetrics: Joi.boolean().default(false),
  }).required(),
});

// Advanced schemas for full feature testing
export const recursiveSchema = Joi.object({
  id: Joi.string().required(),
  children: Joi.array().items(Joi.link('#recursiveSchema')).optional(),
}).id('recursiveSchema');

// Conditional schema using alternatives
export const conditionalSchema = Joi.alternatives().conditional(
  Joi.object({ type: Joi.string().valid('user') }),
  {
    then: Joi.object({
      type: Joi.string().valid('user').required(),
      data: userSchema.required(),
    }),
    otherwise: Joi.object({
      type: Joi.string().valid('admin').required(),
      data: Joi.object({
        permissions: Joi.array().items(Joi.string()).required(),
      }).required(),
    }),
  }
);

// Custom validation with external function
export const customValidationSchema = Joi.object({
  evenNumber: Joi.number().external((value) => {
    if (value % 2 !== 0) {
      throw new Error('Number must be even');
    }
    return value;
  }),
  strongPassword: Joi.string().pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    'strong password'
  ),
});

// Complex nested schema
export const nestedSchema = Joi.object({
  organization: Joi.object({
    name: Joi.string().required(),
    departments: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        employees: Joi.array().items(userSchema).max(100),
        budget: Joi.number().positive(),
        manager: userSchema.optional(),
      })
    ).min(1),
    policies: Joi.object({
      workFromHome: Joi.boolean().default(false),
      flexibleHours: Joi.boolean().default(true),
      maxVacationDays: Joi.number().min(0).max(365).default(25),
    }),
  }),
});

// Date and time schema
export const dateTimeSchema = Joi.object({
  createdAt: Joi.date().iso().required(),
  updatedAt: Joi.date().greater(Joi.ref('createdAt')).required(),
  scheduledFor: Joi.date().min('now').optional(),
  timezone: Joi.string().default('UTC'),
  workingHours: Joi.object({
    start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }),
});

// Binary and file schema
export const fileSchema = Joi.object({
  filename: Joi.string().required(),
  mimetype: Joi.string().valid(
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain'
  ).required(),
  size: Joi.number().max(10 * 1024 * 1024), // 10MB max
  content: Joi.binary().required(),
  metadata: Joi.object({
    uploadedBy: Joi.string().required(),
    uploadedAt: Joi.date().default('now'),
    tags: Joi.array().items(Joi.string()).default([]),
  }),
});

// Exported validation functions
export function validateUser(data: unknown) {
  const result = userSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

export function validateRequest(data: unknown) {
  const result = apiRequestSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

export function validateConfig(data: unknown) {
  const result = configSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

export function validateConditional(data: unknown) {
  const result = conditionalSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

export async function validateCustom(data: unknown) {
  const result = await customValidationSchema.validateAsync(data);
  return result;
}

export function validateNested(data: unknown) {
  const result = nestedSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

export function validateDateTime(data: unknown) {
  const result = dateTimeSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

export function validateFile(data: unknown) {
  const result = fileSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

// Schema compilation for performance (removed as compile method is not available in this version)

console.log('Joi bundle loaded with comprehensive feature set');