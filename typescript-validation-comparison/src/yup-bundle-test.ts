import * as Yup from 'yup';

// 実際の使用パターンを想定したスキーマ
const userSchema = Yup.object({
  id: Yup.string().uuid().required(),
  name: Yup.string().min(1).max(100).required(),
  email: Yup.string().email().required(),
  age: Yup.number().min(18).max(120).required(),
  isActive: Yup.boolean().required(),
  tags: Yup.array().of(Yup.string().required()).required(),
  metadata: Yup.object().optional(),
});

const postSchema = Yup.object({
  title: Yup.string().min(1).max(200).required(),
  content: Yup.string().required(),
  author: userSchema.required(),
  publishedAt: Yup.date().required(),
  category: Yup.string().oneOf(['tech', 'life', 'work']).required(),
});

// 使用例
export async function validateUser(data: unknown) {
  return await userSchema.validate(data);
}

export async function validatePost(data: unknown) {
  return await postSchema.validate(data);
}

// Bundle size test
console.log('Yup bundle test loaded');