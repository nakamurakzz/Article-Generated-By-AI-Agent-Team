import { z } from 'zod';
import * as Yup from 'yup';
import Joi from 'joi';

// =============================================================================
// 高度なエラーハンドリング実装例
// =============================================================================

// 複雑なネストしたオブジェクトのスキーマ
interface ComplexData {
  user: {
    profile: {
      name: string;
      contacts: {
        email: string;
        phone?: string;
      };
    };
    settings: {
      notifications: boolean;
      theme: 'light' | 'dark';
    };
  };
  metadata: {
    tags: string[];
    priority: number;
  };
}

// テストデータ
const validComplexData = {
  user: {
    profile: {
      name: "Alice Johnson",
      contacts: {
        email: "alice@example.com",
        phone: "+1-555-0123"
      }
    },
    settings: {
      notifications: true,
      theme: "dark" as const
    }
  },
  metadata: {
    tags: ["admin", "premium"],
    priority: 5
  }
};

const invalidComplexData = {
  user: {
    profile: {
      name: "",
      contacts: {
        email: "invalid-email",
        phone: 123 // should be string
      }
    },
    settings: {
      notifications: "yes", // should be boolean
      theme: "blue" // invalid enum
    }
  },
  metadata: {
    tags: "not-array", // should be array
    priority: "high" // should be number
  }
};

// =============================================================================
// 1. ZOD - 詳細なエラーハンドリング
// =============================================================================
const zodComplexSchema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string().min(1, "名前は必須です"),
      contacts: z.object({
        email: z.string().email("有効なメールアドレスが必要です"),
        phone: z.string().optional()
      })
    }),
    settings: z.object({
      notifications: z.boolean(),
      theme: z.enum(["light", "dark"], {
        errorMap: () => ({ message: "テーマは'light'または'dark'である必要があります" })
      })
    })
  }),
  metadata: z.object({
    tags: z.array(z.string()).min(1, "最低1つのタグが必要です"),
    priority: z.number().min(1).max(10, "優先度は1-10の範囲である必要があります")
  })
});

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ErrorDetail[];
}

interface ErrorDetail {
  path: string;
  message: string;
  code?: string;
}

export function validateComplexWithZod(data: unknown): ValidationResult<ComplexData> {
  try {
    const result = zodComplexSchema.parse(data);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: ErrorDetail[] = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      
      return {
        success: false,
        errors
      };
    }
    return {
      success: false,
      errors: [{ path: 'root', message: 'Unknown validation error' }]
    };
  }
}

// Zodの部分的バリデーション（一部のフィールドのみ）
export function validatePartialWithZod(data: unknown): ValidationResult<Partial<ComplexData>> {
  const partialSchema = zodComplexSchema.partial();
  
  try {
    const result = partialSchema.parse(data);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      };
    }
    return {
      success: false,
      errors: [{ path: 'root', message: 'Unknown validation error' }]
    };
  }
}

// =============================================================================
// 2. YUP - 詳細なエラーハンドリング
// =============================================================================
const yupComplexSchema = Yup.object({
  user: Yup.object({
    profile: Yup.object({
      name: Yup.string().min(1, "名前は必須です").required(),
      contacts: Yup.object({
        email: Yup.string().email("有効なメールアドレスが必要です").required(),
        phone: Yup.string().optional()
      }).required()
    }).required(),
    settings: Yup.object({
      notifications: Yup.boolean().required(),
      theme: Yup.string().oneOf(["light", "dark"], "テーマは'light'または'dark'である必要があります").required()
    }).required()
  }).required(),
  metadata: Yup.object({
    tags: Yup.array().of(Yup.string().required()).min(1, "最低1つのタグが必要です").required(),
    priority: Yup.number().min(1).max(10, "優先度は1-10の範囲である必要があります").required()
  }).required()
});

export async function validateComplexWithYup(data: unknown): Promise<ValidationResult<ComplexData>> {
  try {
    const result = await yupComplexSchema.validate(data, { 
      abortEarly: false,
      stripUnknown: true 
    });
    return {
      success: true,
      data: result as ComplexData
    };
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      const errors: ErrorDetail[] = error.inner.map(err => ({
        path: err.path || 'unknown',
        message: err.message,
        code: err.type
      }));
      
      return {
        success: false,
        errors: errors.length > 0 ? errors : [{ path: 'root', message: error.message }]
      };
    }
    return {
      success: false,
      errors: [{ path: 'root', message: 'Unknown validation error' }]
    };
  }
}

// Yupのカスタムバリデーション例
const yupCustomSchema = Yup.object({
  user: Yup.object({
    profile: Yup.object({
      name: Yup.string().test(
        'no-profanity',
        '不適切な単語が含まれています',
        function(value) {
          const profanityWords = ['spam', 'abuse'];
          return !profanityWords.some(word => 
            value?.toLowerCase().includes(word)
          );
        }
      ).required()
    }).required()
  }).required()
});

export async function validateCustomWithYup(data: unknown): Promise<ValidationResult<any>> {
  try {
    const result = await yupCustomSchema.validate(data, { abortEarly: false });
    return {
      success: true,
      data: result
    };
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      return {
        success: false,
        errors: error.inner.map(err => ({
          path: err.path || 'unknown',
          message: err.message
        }))
      };
    }
    return {
      success: false,
      errors: [{ path: 'root', message: 'Unknown validation error' }]
    };
  }
}

// =============================================================================
// 3. JOI - 詳細なエラーハンドリング
// =============================================================================
const joiComplexSchema = Joi.object({
  user: Joi.object({
    profile: Joi.object({
      name: Joi.string().min(1).required().messages({
        'string.empty': '名前は必須です',
        'any.required': '名前は必須です'
      }),
      contacts: Joi.object({
        email: Joi.string().email().required().messages({
          'string.email': '有効なメールアドレスが必要です',
          'any.required': 'メールアドレスは必須です'
        }),
        phone: Joi.string().optional()
      }).required()
    }).required(),
    settings: Joi.object({
      notifications: Joi.boolean().required(),
      theme: Joi.string().valid('light', 'dark').required().messages({
        'any.only': "テーマは'light'または'dark'である必要があります"
      })
    }).required()
  }).required(),
  metadata: Joi.object({
    tags: Joi.array().items(Joi.string()).min(1).required().messages({
      'array.min': '最低1つのタグが必要です'
    }),
    priority: Joi.number().min(1).max(10).required().messages({
      'number.min': '優先度は1以上である必要があります',
      'number.max': '優先度は10以下である必要があります'
    })
  }).required()
});

export function validateComplexWithJoi(data: unknown): ValidationResult<ComplexData> {
  const result = joiComplexSchema.validate(data, { 
    abortEarly: false,
    allowUnknown: false
  });
  
  if (result.error) {
    const errors: ErrorDetail[] = result.error.details.map(detail => ({
      path: detail.path.join('.'),
      message: detail.message,
      code: detail.type
    }));
    
    return {
      success: false,
      errors
    };
  }
  
  return {
    success: true,
    data: result.value
  };
}

// Joiのカスタムバリデーション例
const joiCustomSchema = Joi.object({
  user: Joi.object({
    profile: Joi.object({
      name: Joi.string().custom((value, helpers) => {
        const profanityWords = ['spam', 'abuse'];
        const hasProfanity = profanityWords.some(word => 
          value.toLowerCase().includes(word)
        );
        
        if (hasProfanity) {
          return helpers.error('custom.profanity');
        }
        return value;
      }).required().messages({
        'custom.profanity': '不適切な単語が含まれています'
      })
    }).required()
  }).required()
});

export function validateCustomWithJoi(data: unknown): ValidationResult<any> {
  const result = joiCustomSchema.validate(data, { abortEarly: false });
  
  if (result.error) {
    return {
      success: false,
      errors: result.error.details.map(detail => ({
        path: detail.path.join('.'),
        message: detail.message
      }))
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
export async function runErrorHandlingExamples() {
  console.log('=== Advanced Error Handling Examples ===\n');
  
  // 複雑なオブジェクトでのテスト
  console.log('--- Testing complex validation with VALID data ---');
  console.log('Zod Result:', JSON.stringify(validateComplexWithZod(validComplexData), null, 2));
  console.log('Yup Result:', JSON.stringify(await validateComplexWithYup(validComplexData), null, 2));
  console.log('Joi Result:', JSON.stringify(validateComplexWithJoi(validComplexData), null, 2));
  
  console.log('\n--- Testing complex validation with INVALID data ---');
  console.log('Zod Result:', JSON.stringify(validateComplexWithZod(invalidComplexData), null, 2));
  console.log('Yup Result:', JSON.stringify(await validateComplexWithYup(invalidComplexData), null, 2));
  console.log('Joi Result:', JSON.stringify(validateComplexWithJoi(invalidComplexData), null, 2));
  
  // カスタムバリデーションのテスト
  console.log('\n--- Testing custom validation ---');
  const dataWithProfanity = {
    user: {
      profile: {
        name: "spam user"
      }
    }
  };
  
  console.log('Yup Custom Result:', JSON.stringify(await validateCustomWithYup(dataWithProfanity), null, 2));
  console.log('Joi Custom Result:', JSON.stringify(validateCustomWithJoi(dataWithProfanity), null, 2));
}

if (require.main === module) {
  runErrorHandlingExamples();
}