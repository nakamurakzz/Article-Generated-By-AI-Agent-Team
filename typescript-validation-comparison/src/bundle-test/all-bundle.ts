// Combined Bundle Size Test - All libraries together
import { z } from 'zod';
import * as Yup from 'yup';
import Joi from 'joi';

// Test combined usage scenario
const testData = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test User',
  email: 'test@example.com',
  age: 25,
  isActive: true,
  tags: ['developer', 'typescript'],
  profile: {
    bio: 'Software developer',
    avatar: 'https://example.com/avatar.jpg',
    preferences: { theme: 'dark' },
  },
};

// Simple schema comparison
const zodSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
});

const yupSchema = Yup.object({
  name: Yup.string().required(),
  age: Yup.number().required(),
  email: Yup.string().email().required(),
});

const joiSchema = Joi.object({
  name: Joi.string().required(),
  age: Joi.number().required(),
  email: Joi.string().email().required(),
});

export function testAllLibraries() {
  try {
    const zodResult = zodSchema.parse(testData);
    console.log('Zod validation passed:', zodResult);
    
    yupSchema.validate(testData).then((result) => {
      console.log('Yup validation passed:', result);
    });
    
    const joiResult = joiSchema.validate(testData);
    if (!joiResult.error) {
      console.log('Joi validation passed:', joiResult.value);
    }
    
    return 'All validations completed';
  } catch (error) {
    console.error('Validation error:', error);
    return 'Validation failed';
  }
}

// Export individual validation functions for bundle analysis
export function zodValidation(data: unknown) {
  return zodSchema.parse(data);
}

export async function yupValidation(data: unknown) {
  return await yupSchema.validate(data);
}

export function joiValidation(data: unknown) {
  const result = joiSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

console.log('Combined validation bundle loaded');