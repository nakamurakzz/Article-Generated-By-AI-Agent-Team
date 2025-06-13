import Joi from 'joi';

// 実際の使用パターンを想定したスキーマ
const userSchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  age: Joi.number().min(18).max(120).required(),
  isActive: Joi.boolean().required(),
  tags: Joi.array().items(Joi.string()).required(),
  metadata: Joi.object().optional(),
});

const postSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  content: Joi.string().required(),
  author: userSchema.required(),
  publishedAt: Joi.date().required(),
  category: Joi.string().valid('tech', 'life', 'work').required(),
});

// 使用例
export function validateUser(data: unknown) {
  const result = userSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

export function validatePost(data: unknown) {
  const result = postSchema.validate(data);
  if (result.error) throw result.error;
  return result.value;
}

// Bundle size test
console.log('Joi bundle test loaded');