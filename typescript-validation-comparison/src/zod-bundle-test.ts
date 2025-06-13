import { z } from 'zod';

// 実際の使用パターンを想定したスキーマ
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(18).max(120),
  isActive: z.boolean(),
  tags: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
});

const postSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
  author: userSchema,
  publishedAt: z.date(),
  category: z.enum(['tech', 'life', 'work']),
});

// 使用例
export function validateUser(data: unknown) {
  return userSchema.parse(data);
}

export function validatePost(data: unknown) {
  return postSchema.parse(data);
}

// Bundle size test
console.log('Zod bundle test loaded');