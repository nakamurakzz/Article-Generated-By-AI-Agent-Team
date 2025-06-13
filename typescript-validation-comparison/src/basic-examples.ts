import { z } from 'zod';
import * as Yup from 'yup';
import Joi from 'joi';

// 共通のテストデータ型定義
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
}

// テストデータ
const validUserData = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  age: 30,
  isActive: true
};

const invalidUserData = {
  id: "invalid",
  name: "",
  email: "invalid-email",
  age: -5,
  isActive: "not-boolean"
};

// =============================================================================
// 1. ZOD実装例
// =============================================================================
const zodUserSchema = z.object({
  id: z.number().positive("IDは正の数である必要があります"),
  name: z.string().min(1, "名前は必須です").max(100, "名前は100文字以下である必要があります"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  age: z.number().min(0, "年齢は0以上である必要があります").max(150, "年齢は150以下である必要があります"),
  isActive: z.boolean()
});

type ZodUser = z.infer<typeof zodUserSchema>;

export function validateWithZod(data: unknown): { success: boolean; data?: ZodUser; errors?: string[] } {
  try {
    const result = zodUserSchema.parse(data);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      success: false,
      errors: ['Unknown validation error']
    };
  }
}

// =============================================================================
// 2. YUP実装例
// =============================================================================
const yupUserSchema = Yup.object({
  id: Yup.number()
    .positive("IDは正の数である必要があります")
    .required("IDは必須です"),
  name: Yup.string()
    .min(1, "名前は必須です")
    .max(100, "名前は100文字以下である必要があります")
    .required("名前は必須です"),
  email: Yup.string()
    .email("有効なメールアドレスを入力してください")
    .required("メールアドレスは必須です"),
  age: Yup.number()
    .min(0, "年齢は0以上である必要があります")
    .max(150, "年齢は150以下である必要があります")
    .required("年齢は必須です"),
  isActive: Yup.boolean().required("アクティブ状態は必須です")
});

type YupUser = Yup.InferType<typeof yupUserSchema>;

export async function validateWithYup(data: unknown): Promise<{ success: boolean; data?: YupUser; errors?: string[] }> {
  try {
    const result = await yupUserSchema.validate(data, { abortEarly: false });
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      return {
        success: false,
        errors: error.errors
      };
    }
    return {
      success: false,
      errors: ['Unknown validation error']
    };
  }
}

// =============================================================================
// 3. JOI実装例
// =============================================================================
const joiUserSchema = Joi.object({
  id: Joi.number()
    .positive()
    .required()
    .messages({
      'number.positive': 'IDは正の数である必要があります',
      'any.required': 'IDは必須です'
    }),
  name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': '名前は必須です',
      'string.max': '名前は100文字以下である必要があります',
      'any.required': '名前は必須です'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': '有効なメールアドレスを入力してください',
      'any.required': 'メールアドレスは必須です'
    }),
  age: Joi.number()
    .min(0)
    .max(150)
    .required()
    .messages({
      'number.min': '年齢は0以上である必要があります',
      'number.max': '年齢は150以下である必要があります',
      'any.required': '年齢は必須です'
    }),
  isActive: Joi.boolean()
    .required()
    .messages({
      'any.required': 'アクティブ状態は必須です'
    })
});

export function validateWithJoi(data: unknown): { success: boolean; data?: User; errors?: string[] } {
  const result = joiUserSchema.validate(data, { abortEarly: false });
  
  if (result.error) {
    return {
      success: false,
      errors: result.error.details.map(detail => detail.message)
    };
  }
  
  return {
    success: true,
    data: result.value
  };
}

// =============================================================================
// 実行例
// =============================================================================
export async function runBasicExamples() {
  console.log('=== Basic Validation Examples ===\n');
  
  // 有効なデータでのテスト
  console.log('--- Testing with VALID data ---');
  console.log('Zod Result:', validateWithZod(validUserData));
  console.log('Yup Result:', await validateWithYup(validUserData));
  console.log('Joi Result:', validateWithJoi(validUserData));
  
  console.log('\n--- Testing with INVALID data ---');
  console.log('Zod Result:', validateWithZod(invalidUserData));
  console.log('Yup Result:', await validateWithYup(invalidUserData));
  console.log('Joi Result:', validateWithJoi(invalidUserData));
}

if (require.main === module) {
  runBasicExamples();
}