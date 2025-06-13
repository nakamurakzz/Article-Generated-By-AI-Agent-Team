// Minimal Joi usage for tree-shaking test
import Joi from 'joi';

// Only basic string validation
const simpleSchema = Joi.string().required();

export function validateString(data: unknown) {
  const result = simpleSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

console.log('Minimal Joi bundle loaded');