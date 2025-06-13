import { z } from 'zod';
import * as Yup from 'yup';
import Joi from 'joi';

// =============================================================================
// 中級者向け実用的コード例
// =============================================================================

// 1. API レスポンス型とバリデーション
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    timestamp: Date;
    version: string;
    requestId: string;
  };
}

// 2. E-commerce ドメインオブジェクト
interface User {
  id: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    preferences: {
      language: 'ja' | 'en' | 'zh';
      currency: 'JPY' | 'USD' | 'EUR';
      notifications: {
        email: boolean;
        push: boolean;
        sms: boolean;
      };
    };
  };
  subscription: {
    plan: 'free' | 'premium' | 'enterprise';
    validUntil?: Date;
    features: string[];
  };
  addresses: Address[];
  createdAt: Date;
  updatedAt: Date;
}

interface Address {
  id: string;
  type: 'home' | 'work' | 'other';
  country: string;
  postalCode: string;
  city: string;
  street: string;
  isDefault: boolean;
}

interface Order {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  shipping: {
    address: Address;
    method: 'standard' | 'express' | 'overnight';
    cost: number;
    estimatedDelivery: Date;
  };
  payment: {
    method: 'card' | 'paypal' | 'bank_transfer';
    amount: number;
    currency: 'JPY' | 'USD' | 'EUR';
    taxAmount: number;
    discountAmount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations?: Record<string, any>;
}

// =============================================================================
// 1. ZOD - 実用的な実装例
// =============================================================================

// 再利用可能なバリデータ
const zodCommonValidators = {
  id: z.string().uuid(),
  email: z.string().email("有効なメールアドレスを入力してください"),
  japanesePostalCode: z.string().regex(/^\d{3}-?\d{4}$/, "郵便番号は000-0000形式で入力してください"),
  phoneNumber: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, "有効な電話番号を入力してください"),
  currency: z.enum(['JPY', 'USD', 'EUR']),
  language: z.enum(['ja', 'en', 'zh'])
};

// アドレススキーマ
const zodAddressSchema = z.object({
  id: zodCommonValidators.id,
  type: z.enum(['home', 'work', 'other']),
  country: z.string().min(2, "国コードは2文字以上である必要があります"),
  postalCode: zodCommonValidators.japanesePostalCode,
  city: z.string().min(1, "市区町村は必須です"),
  street: z.string().min(1, "住所は必須です"),
  isDefault: z.boolean()
});

// ユーザースキーマ（階層構造）
const zodUserSchema = z.object({
  id: zodCommonValidators.id,
  email: zodCommonValidators.email,
  profile: z.object({
    firstName: z.string().min(1, "名前は必須です").max(50, "名前は50文字以下である必要があります"),
    lastName: z.string().min(1, "姓は必須です").max(50, "姓は50文字以下である必要があります"),
    avatar: z.string().url("有効なURLを入力してください").optional(),
    preferences: z.object({
      language: zodCommonValidators.language,
      currency: zodCommonValidators.currency,
      notifications: z.object({
        email: z.boolean(),
        push: z.boolean(),
        sms: z.boolean()
      })
    })
  }),
  subscription: z.object({
    plan: z.enum(['free', 'premium', 'enterprise']),
    validUntil: z.date().optional(),
    features: z.array(z.string())
  }),
  addresses: z.array(zodAddressSchema).min(1, "最低1つの住所が必要です"),
  createdAt: z.date(),
  updatedAt: z.date()
}).superRefine((data, ctx) => {
  // カスタムバリデーション: デフォルト住所が1つだけあることを確認
  const defaultAddresses = data.addresses.filter(addr => addr.isDefault);
  if (defaultAddresses.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['addresses'],
      message: 'デフォルト住所は1つだけ設定してください'
    });
  }
  
  // カスタムバリデーション: プレミアムプランの有効期限チェック
  if (data.subscription.plan !== 'free' && !data.subscription.validUntil) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subscription', 'validUntil'],
      message: '有料プランには有効期限が必要です'
    });
  }
});

// 注文スキーマ（関連性のあるデータ）
const zodOrderItemSchema = z.object({
  productId: zodCommonValidators.id,
  quantity: z.number().positive("数量は正の数である必要があります"),
  unitPrice: z.number().positive("単価は正の数である必要があります"),
  totalPrice: z.number().positive("合計価格は正の数である必要があります"),
  customizations: z.record(z.any()).optional()
}).superRefine((data, ctx) => {
  // カスタムバリデーション: 合計価格の整合性チェック
  const expectedTotal = data.quantity * data.unitPrice;
  if (Math.abs(data.totalPrice - expectedTotal) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['totalPrice'],
      message: '合計価格が数量×単価と一致しません'
    });
  }
});

const zodOrderSchema = z.object({
  id: zodCommonValidators.id,
  userId: zodCommonValidators.id,
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  items: z.array(zodOrderItemSchema).min(1, "最低1つの商品が必要です"),
  shipping: z.object({
    address: zodAddressSchema,
    method: z.enum(['standard', 'express', 'overnight']),
    cost: z.number().nonnegative("送料は0以上である必要があります"),
    estimatedDelivery: z.date().min(new Date(), "配送予定日は未来の日付である必要があります")
  }),
  payment: z.object({
    method: z.enum(['card', 'paypal', 'bank_transfer']),
    amount: z.number().positive("支払い金額は正の数である必要があります"),
    currency: zodCommonValidators.currency,
    taxAmount: z.number().nonnegative("税額は0以上である必要があります"),
    discountAmount: z.number().nonnegative("割引額は0以上である必要があります").optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
}).superRefine((data, ctx) => {
  // カスタムバリデーション: 支払い金額の整合性チェック
  const itemsTotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const expectedAmount = itemsTotal + data.shipping.cost + data.payment.taxAmount - (data.payment.discountAmount || 0);
  
  if (Math.abs(data.payment.amount - expectedAmount) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['payment', 'amount'],
      message: '支払い金額が計算結果と一致しません'
    });
  }
});

// ページネーション付きレスポンススキーマ（ジェネリック）
const createZodPaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number().positive("ページ番号は正の数である必要があります"),
      limit: z.number().positive("制限数は正の数である必要があります").max(100, "制限数は100以下である必要があります"),
      total: z.number().nonnegative("総数は0以上である必要があります"),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    }),
    meta: z.object({
      timestamp: z.date(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/, "バージョンはセマンティックバージョニング形式である必要があります"),
      requestId: zodCommonValidators.id
    })
  }).superRefine((data, ctx) => {
    // ページネーションの整合性チェック
    const maxPage = Math.ceil(data.pagination.total / data.pagination.limit);
    if (data.pagination.page > maxPage && data.pagination.total > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagination', 'page'],
        message: 'ページ番号が総ページ数を超えています'
      });
    }
    
    // hasNext/hasPrevの整合性チェック
    const expectedHasNext = data.pagination.page < maxPage;
    const expectedHasPrev = data.pagination.page > 1;
    
    if (data.pagination.hasNext !== expectedHasNext) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagination', 'hasNext'],
        message: 'hasNextの値が不正です'
      });
    }
    
    if (data.pagination.hasPrev !== expectedHasPrev) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagination', 'hasPrev'],
        message: 'hasPrevの値が不正です'
      });
    }
  });

// 実用的なZodバリデーション関数
export class ZodValidationService {
  static validateUser(data: unknown): { success: boolean; data?: User; errors?: string[] } {
    try {
      const result = zodUserSchema.parse(data);
      return { success: true, data: result as User };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }
  
  static validateOrder(data: unknown): { success: boolean; data?: Order; errors?: string[] } {
    try {
      const result = zodOrderSchema.parse(data);
      return { success: true, data: result as Order };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }
  
  static validatePaginatedUsers(data: unknown) {
    const schema = createZodPaginatedResponseSchema(zodUserSchema);
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }
}

// =============================================================================
// 2. YUP - 実用的な実装例
// =============================================================================

// 再利用可能なバリデータ
const yupCommonValidators = {
  id: Yup.string().uuid("有効なUUIDを入力してください").required(),
  email: Yup.string().email("有効なメールアドレスを入力してください").required(),
  japanesePostalCode: Yup.string().matches(/^\d{3}-?\d{4}$/, "郵便番号は000-0000形式で入力してください").required(),
  phoneNumber: Yup.string().matches(/^[\+]?[1-9][\d]{0,15}$/, "有効な電話番号を入力してください").required(),
  currency: Yup.string().oneOf(['JPY', 'USD', 'EUR']).required(),
  language: Yup.string().oneOf(['ja', 'en', 'zh']).required()
};

// アドレススキーマ
const yupAddressSchema = Yup.object({
  id: yupCommonValidators.id,
  type: Yup.string().oneOf(['home', 'work', 'other']).required(),
  country: Yup.string().min(2, "国コードは2文字以上である必要があります").required(),
  postalCode: yupCommonValidators.japanesePostalCode,
  city: Yup.string().min(1, "市区町村は必須です").required(),
  street: Yup.string().min(1, "住所は必須です").required(),
  isDefault: Yup.boolean().required()
});

// ユーザースキーマ
const yupUserSchema = Yup.object({
  id: yupCommonValidators.id,
  email: yupCommonValidators.email,
  profile: Yup.object({
    firstName: Yup.string().min(1, "名前は必須です").max(50, "名前は50文字以下である必要があります").required(),
    lastName: Yup.string().min(1, "姓は必須です").max(50, "姓は50文字以下である必要があります").required(),
    avatar: Yup.string().url("有効なURLを入力してください").optional(),
    preferences: Yup.object({
      language: yupCommonValidators.language,
      currency: yupCommonValidators.currency,
      notifications: Yup.object({
        email: Yup.boolean().required(),
        push: Yup.boolean().required(),
        sms: Yup.boolean().required()
      }).required()
    }).required()
  }).required(),
  subscription: Yup.object({
    plan: Yup.string().oneOf(['free', 'premium', 'enterprise']).required(),
    validUntil: Yup.date().optional().nullable(),
    features: Yup.array().of(Yup.string().required()).required()
  }).required().test(
    'premium-validation',
    '有料プランには有効期限が必要です',
    function(value) {
      if (value.plan !== 'free' && !value.validUntil) {
        return this.createError({
          path: 'subscription.validUntil',
          message: '有料プランには有効期限が必要です'
        });
      }
      return true;
    }
  ),
  addresses: Yup.array().of(yupAddressSchema.required()).min(1, "最低1つの住所が必要です").required()
    .test(
      'default-address',
      'デフォルト住所は1つだけ設定してください',
      function(addresses) {
        if (!addresses) return true;
        const defaultCount = addresses.filter(addr => addr.isDefault).length;
        return defaultCount === 1;
      }
    ),
  createdAt: Yup.date().required(),
  updatedAt: Yup.date().required()
});

export class YupValidationService {
  static async validateUser(data: unknown): Promise<{ success: boolean; data?: User; errors?: string[] }> {
    try {
      const result = await yupUserSchema.validate(data, { abortEarly: false });
      return { success: true, data: result as User };
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        return {
          success: false,
          errors: error.errors
        };
      }
      return { success: false, errors: ['Unknown validation error'] };
    }
  }
}

// =============================================================================
// 3. JOI - 実用的な実装例
// =============================================================================

// 再利用可能なバリデータ
const joiCommonValidators = {
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
  email: Joi.string().email().required(),
  japanesePostalCode: Joi.string().pattern(/^\d{3}-?\d{4}$/).required().messages({
    'string.pattern.base': '郵便番号は000-0000形式で入力してください'
  }),
  phoneNumber: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).required().messages({
    'string.pattern.base': '有効な電話番号を入力してください'
  }),
  currency: Joi.string().valid('JPY', 'USD', 'EUR').required(),
  language: Joi.string().valid('ja', 'en', 'zh').required()
};

// アドレススキーマ
const joiAddressSchema = Joi.object({
  id: joiCommonValidators.id,
  type: Joi.string().valid('home', 'work', 'other').required(),
  country: Joi.string().min(2).required().messages({
    'string.min': '国コードは2文字以上である必要があります'
  }),
  postalCode: joiCommonValidators.japanesePostalCode,
  city: Joi.string().min(1).required().messages({
    'string.min': '市区町村は必須です'
  }),
  street: Joi.string().min(1).required().messages({
    'string.min': '住所は必須です'
  }),
  isDefault: Joi.boolean().required()
});

// ユーザースキーマ（複雑なカスタムバリデーション付き）
const joiUserSchema = Joi.object<User>({
  id: joiCommonValidators.id,
  email: joiCommonValidators.email,
  profile: Joi.object({
    firstName: Joi.string().min(1).max(50).required().messages({
      'string.min': '名前は必須です',
      'string.max': '名前は50文字以下である必要があります'
    }),
    lastName: Joi.string().min(1).max(50).required().messages({
      'string.min': '姓は必須です',
      'string.max': '姓は50文字以下である必要があります'
    }),
    avatar: Joi.string().uri().optional(),
    preferences: Joi.object({
      language: joiCommonValidators.language,
      currency: joiCommonValidators.currency,
      notifications: Joi.object({
        email: Joi.boolean().required(),
        push: Joi.boolean().required(),
        sms: Joi.boolean().required()
      }).required()
    }).required()
  }).required(),
  subscription: Joi.object({
    plan: Joi.string().valid('free', 'premium', 'enterprise').required(),
    validUntil: Joi.date().optional().allow(null),
    features: Joi.array().items(Joi.string()).required()
  }).required().custom((value, helpers) => {
    // カスタムバリデーション: 有料プランの有効期限チェック
    if (value.plan !== 'free' && !value.validUntil) {
      return helpers.error('subscription.premium-validation');
    }
    return value;
  }).messages({
    'subscription.premium-validation': '有料プランには有効期限が必要です'
  }),
  addresses: Joi.array().items(joiAddressSchema).min(1).required()
    .custom((addresses, helpers) => {
      // カスタムバリデーション: デフォルト住所チェック
      const defaultCount = addresses.filter((addr: any) => addr.isDefault).length;
      if (defaultCount !== 1) {
        return helpers.error('addresses.default-validation');
      }
      return addresses;
    }).messages({
      'array.min': '最低1つの住所が必要です',
      'addresses.default-validation': 'デフォルト住所は1つだけ設定してください'
    }),
  createdAt: Joi.date().required(),
  updatedAt: Joi.date().required()
});

export class JoiValidationService {
  static validateUser(data: unknown): { success: boolean; data?: User; errors?: string[] } {
    const result = joiUserSchema.validate(data, { abortEarly: false });
    
    if (result.error) {
      return {
        success: false,
        errors: result.error.details.map(detail => detail.message)
      };
    }
    
    return { success: true, data: result.value };
  }
}

// =============================================================================
// 実行例とテストデータ
// =============================================================================

const createTestUser = (): User => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "test@example.com",
  profile: {
    firstName: "太郎",
    lastName: "山田",
    avatar: "https://example.com/avatar.jpg",
    preferences: {
      language: "ja",
      currency: "JPY",
      notifications: {
        email: true,
        push: false,
        sms: true
      }
    }
  },
  subscription: {
    plan: "premium",
    validUntil: new Date("2024-12-31"),
    features: ["advanced_analytics", "priority_support"]
  },
  addresses: [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      type: "home",
      country: "JP",
      postalCode: "100-0001",
      city: "東京都千代田区",
      street: "千代田1-1-1",
      isDefault: true
    }
  ],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-15")
});

const createInvalidUser = () => ({
  id: "invalid-uuid",
  email: "invalid-email",
  profile: {
    firstName: "",
    lastName: "",
    avatar: "not-a-url",
    preferences: {
      language: "invalid",
      currency: "INVALID",
      notifications: {
        email: "not-boolean",
        push: "not-boolean",
        sms: "not-boolean"
      }
    }
  },
  subscription: {
    plan: "premium", // 有料プランだがvalidUntilがない
    features: []
  },
  addresses: [
    {
      id: "invalid-uuid",
      type: "invalid",
      country: "A", // 短すぎる
      postalCode: "invalid",
      city: "",
      street: "",
      isDefault: false // デフォルト住所がない
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      type: "work",
      country: "JP",
      postalCode: "200-0001",
      city: "東京都",
      street: "新宿1-1-1",
      isDefault: true // 複数のデフォルト住所（無効）
    }
  ],
  createdAt: "invalid-date",
  updatedAt: null
});

export async function runRealWorldExamples() {
  console.log('=== Real-World Validation Examples ===\n');
  
  const validUser = createTestUser();
  const invalidUser = createInvalidUser();
  
  console.log('--- Testing with VALID user data ---');
  console.log('Zod Result:', JSON.stringify(ZodValidationService.validateUser(validUser), null, 2));
  console.log('Yup Result:', JSON.stringify(await YupValidationService.validateUser(validUser), null, 2));
  console.log('Joi Result:', JSON.stringify(JoiValidationService.validateUser(validUser), null, 2));
  
  console.log('\n--- Testing with INVALID user data ---');
  console.log('Zod Result:', JSON.stringify(ZodValidationService.validateUser(invalidUser), null, 2));
  console.log('Yup Result:', JSON.stringify(await YupValidationService.validateUser(invalidUser), null, 2));
  console.log('Joi Result:', JSON.stringify(JoiValidationService.validateUser(invalidUser), null, 2));
}

if (require.main === module) {
  runRealWorldExamples();
}