import { z } from 'zod';
import * as Yup from 'yup';
import Joi from 'joi';

// =============================================================================
// 型安全性テストケース
// =============================================================================

// テスト用の複雑な型構造
interface ApiResponse<T> {
  data: T;
  meta: {
    total: number;
    page: number;
    hasNext: boolean;
  };
  errors?: string[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: 'electronics' | 'clothing' | 'books';
  tags: string[];
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// 1. ZOD - 型安全性の検証
// =============================================================================

// Zodスキーマから型を自動推論
const zodProductSchema = z.object({
  id: z.string().uuid("有効なUUIDが必要です"),
  name: z.string().min(1, "商品名は必須です").max(100, "商品名は100文字以下にしてください"),
  price: z.number().positive("価格は正の数である必要があります"),
  category: z.enum(['electronics', 'clothing', 'books'], {
    errorMap: () => ({ message: "有効なカテゴリを選択してください" })
  }),
  tags: z.array(z.string()).min(1, "最低1つのタグが必要です"),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive()
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Zodから推論された型
type ZodProduct = z.infer<typeof zodProductSchema>;

const zodApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z.object({
      total: z.number().nonnegative(),
      page: z.number().positive(),
      hasNext: z.boolean()
    }),
    errors: z.array(z.string()).optional()
  });

type ZodApiResponse<T> = z.infer<ReturnType<typeof zodApiResponseSchema<z.ZodType<T>>>>;

export function validateZodProduct(data: unknown): { success: boolean; data?: ZodProduct; errors?: string[] } {
  try {
    const result = zodProductSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Unknown error'] };
  }
}

// Zodのtransform機能（型変換）
const zodTransformSchema = z.object({
  price: z.string().transform((val, ctx) => {
    const parsed = parseInt(val);
    if (isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "有効な数値を入力してください"
      });
      return z.NEVER;
    }
    return parsed;
  }),
  createdAt: z.string().transform((val, ctx) => {
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "有効な日付を入力してください"
      });
      return z.NEVER;
    }
    return date;
  }),
  tags: z.string().transform(val => val.split(',').map(tag => tag.trim()))
});

export function validateZodTransform(data: unknown) {
  try {
    const result = zodTransformSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { success: false, errors: ['Unknown error'] };
  }
}

// =============================================================================
// 2. YUP - 型安全性の検証
// =============================================================================

const yupProductSchema = Yup.object({
  id: Yup.string().uuid("有効なUUIDが必要です").required(),
  name: Yup.string().min(1, "商品名は必須です").max(100, "商品名は100文字以下にしてください").required(),
  price: Yup.number().positive("価格は正の数である必要があります").required(),
  category: Yup.string().oneOf(['electronics', 'clothing', 'books'], "有効なカテゴリを選択してください").required(),
  tags: Yup.array().of(Yup.string().required()).min(1, "最低1つのタグが必要です").required(),
  dimensions: Yup.object({
    width: Yup.number().positive().required(),
    height: Yup.number().positive().required(),
    depth: Yup.number().positive().required()
  }).optional().nullable(),
  createdAt: Yup.date().required(),
  updatedAt: Yup.date().required()
});

// Yupから推論された型
type YupProduct = Yup.InferType<typeof yupProductSchema>;

const createYupApiResponseSchema = <T extends Yup.AnyObjectSchema>(dataSchema: T) =>
  Yup.object({
    data: dataSchema.required(),
    meta: Yup.object({
      total: Yup.number().min(0).required(),
      page: Yup.number().positive().required(),
      hasNext: Yup.boolean().required()
    }).required(),
    errors: Yup.array().of(Yup.string().required()).optional()
  });

export async function validateYupProduct(data: unknown): Promise<{ success: boolean; data?: YupProduct; errors?: string[] }> {
  try {
    const result = await yupProductSchema.validate(data, { abortEarly: false });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      return {
        success: false,
        errors: error.errors
      };
    }
    return { success: false, errors: ['Unknown error'] };
  }
}

// Yupのtransform機能
const yupTransformSchema = Yup.object({
  price: Yup.mixed().transform((value, originalValue) => {
    if (typeof originalValue === 'string') {
      const parsed = parseInt(originalValue);
      return isNaN(parsed) ? undefined : parsed;
    }
    return originalValue;
  }).test('is-number', '有効な数値を入力してください', val => typeof val === 'number' && !isNaN(val)),
  
  createdAt: Yup.mixed().transform((value, originalValue) => {
    if (typeof originalValue === 'string') {
      const date = new Date(originalValue);
      return isNaN(date.getTime()) ? undefined : date;
    }
    return originalValue;
  }).test('is-date', '有効な日付を入力してください', val => val instanceof Date && !isNaN(val.getTime())),
  
  tags: Yup.mixed().transform(val => 
    typeof val === 'string' ? val.split(',').map(tag => tag.trim()) : val
  )
});

export async function validateYupTransform(data: unknown) {
  try {
    const result = await yupTransformSchema.validate(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      return {
        success: false,
        errors: error.errors
      };
    }
    return { success: false, errors: ['Unknown error'] };
  }
}

// =============================================================================
// 3. JOI - 型安全性の検証（TypeScript統合）
// =============================================================================

const joiProductSchema = Joi.object<Product>({
  id: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': '有効なUUIDが必要です'
  }),
  name: Joi.string().min(1).max(100).required().messages({
    'string.empty': '商品名は必須です',
    'string.max': '商品名は100文字以下にしてください'
  }),
  price: Joi.number().positive().required().messages({
    'number.positive': '価格は正の数である必要があります'
  }),
  category: Joi.string().valid('electronics', 'clothing', 'books').required().messages({
    'any.only': '有効なカテゴリを選択してください'
  }),
  tags: Joi.array().items(Joi.string()).min(1).required().messages({
    'array.min': '最低1つのタグが必要です'
  }),
  dimensions: Joi.object({
    width: Joi.number().positive().required(),
    height: Joi.number().positive().required(),
    depth: Joi.number().positive().required()
  }).optional(),
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required()
});

const createJoiApiResponseSchema = <T>(dataSchema: Joi.ObjectSchema<T>) =>
  Joi.object<ApiResponse<T>>({
    data: dataSchema.required(),
    meta: Joi.object({
      total: Joi.number().min(0).required(),
      page: Joi.number().positive().required(),
      hasNext: Joi.boolean().required()
    }).required(),
    errors: Joi.array().items(Joi.string()).optional()
  });

export function validateJoiProduct(data: unknown): { success: boolean; data?: Product; errors?: string[] } {
  const result = joiProductSchema.validate(data, { abortEarly: false });
  
  if (result.error) {
    return {
      success: false,
      errors: result.error.details.map(detail => detail.message)
    };
  }
  
  return { success: true, data: result.value };
}

// Joiのtransform機能（convert オプション使用）
const joiTransformSchema = Joi.object({
  price: Joi.alternatives().try(
    Joi.number(),
    Joi.string().pattern(/^\d+$/).custom((value, helpers) => {
      const parsed = parseInt(value);
      if (isNaN(parsed)) {
        return helpers.error('custom.invalid-number');
      }
      return parsed;
    })
  ).messages({
    'custom.invalid-number': '有効な数値を入力してください'
  }),
  
  createdAt: Joi.alternatives().try(
    Joi.date(),
    Joi.string().custom((value, helpers) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return helpers.error('custom.invalid-date');
      }
      return date;
    })
  ).messages({
    'custom.invalid-date': '有効な日付を入力してください'
  }),
  
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string().custom((value, helpers) => {
      return value.split(',').map((tag: string) => tag.trim());
    })
  )
});

export function validateJoiTransform(data: unknown) {
  const result = joiTransformSchema.validate(data, { 
    abortEarly: false,
    convert: true
  });
  
  if (result.error) {
    return {
      success: false,
      errors: result.error.details.map(detail => detail.message)
    };
  }
  
  return { success: true, data: result.value };
}

// =============================================================================
// 型安全性比較テスト
// =============================================================================

export async function runTypeSafetyTests() {
  console.log('=== Type Safety Comparison Tests ===\n');
  
  const validProductData = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Laptop Computer",
    price: 999.99,
    category: "electronics" as const,
    tags: ["computer", "laptop", "portable"],
    dimensions: {
      width: 35,
      height: 2.5,
      depth: 25
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15')
  };
  
  const invalidProductData = {
    id: "invalid-uuid",
    name: "",
    price: -100,
    category: "invalid-category",
    tags: [],
    dimensions: {
      width: -5,
      height: 0,
      depth: "not-number"
    },
    createdAt: "invalid-date",
    updatedAt: null
  };
  
  console.log('--- Testing with VALID product data ---');
  console.log('Zod Result:', validateZodProduct(validProductData));
  console.log('Yup Result:', await validateYupProduct(validProductData));
  console.log('Joi Result:', validateJoiProduct(validProductData));
  
  console.log('\n--- Testing with INVALID product data ---');
  console.log('Zod Result:', validateZodProduct(invalidProductData));
  console.log('Yup Result:', await validateYupProduct(invalidProductData));
  console.log('Joi Result:', validateJoiProduct(invalidProductData));
  
  // Transform機能のテスト
  console.log('\n--- Testing transform capabilities ---');
  const transformData = {
    price: "999",
    createdAt: "2024-01-01",
    tags: "electronics,computer,laptop"
  };
  
  console.log('Zod Transform:', validateZodTransform(transformData));
  console.log('Yup Transform:', await validateYupTransform(transformData));
  console.log('Joi Transform:', validateJoiTransform(transformData));
}

// TypeScript型チェッカーでの型安全性確認例
export function demonstrateTypeInference() {
  // Zodの型推論
  const zodData: ZodProduct = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Test Product",
    price: 100,
    category: "electronics", // 型安全：'electronics' | 'clothing' | 'books' のみ許可
    tags: ["test"],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Yupの型推論
  const yupData: YupProduct = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Test Product",
    price: 100,
    category: "electronics",
    tags: ["test"],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // コンパイル時型チェック例
  // 以下はTypeScriptコンパイラがエラーを検出する
  /*
  const invalidZodData: ZodProduct = {
    id: 123, // エラー：string型が期待される
    category: "invalid", // エラー：許可されていない値
    // name: 必須フィールドが不足
  };
  */
  
  return { zodData, yupData };
}

if (require.main === module) {
  runTypeSafetyTests();
}