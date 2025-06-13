// Minimal Yup usage for tree-shaking test
import * as Yup from 'yup';

// Only basic string validation
const simpleSchema = Yup.string().required();

export async function validateString(data: unknown) {
  return await simpleSchema.validate(data);
}

console.log('Minimal Yup bundle loaded');