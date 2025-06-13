// Minimal Zod usage for tree-shaking test
import { z } from 'zod';

// Only basic string validation
const simpleSchema = z.string();

export function validateString(data: unknown) {
  return simpleSchema.parse(data);
}

console.log('Minimal Zod bundle loaded');