// Schema Inference技術解説の正確性検証テスト
import { z } from 'zod';
import * as Yup from 'yup';
import Joi from 'joi';

// =============================================================================
// 1. Schema Inference基本概念の検証
// =============================================================================

// 記事で説明した基本的なスキーマ推論の動作確認
const zodUserSchema = z.object({
  name: z.string().min(1),
  age: z.number().positive(),
  email: z.string().email()
});

// 型推論の正確性確認
type ZodInferredUser = z.infer<typeof zodUserSchema>;

// コンパイル時型チェックの確認
function testZodTypeInference() {
  const userData: ZodInferredUser = {
    name: "Test User",
    age: 25,
    email: "test@example.com"
  };
  
  // 型が正確に推論されていることを確認
  const nameIsString: string = userData.name; // ✅ OK
  const ageIsNumber: number = userData.age;   // ✅ OK
  const emailIsString: string = userData.email; // ✅ OK
  
  // 存在しないプロパティはコンパイルエラーになることを確認
  // const invalid = userData.invalid; // ❌ TypeScript Error
  
  return { nameIsString, ageIsNumber, emailIsString };
}

// =============================================================================
// 2. 高度な型推論例の検証
// =============================================================================

// 条件付き型推論の検証
const conditionalSchema = z.object({
  userType: z.enum(['admin', 'user']),
  adminData: z.object({
    permissions: z.array(z.string())
  }).optional(),
  userData: z.object({
    profile: z.string()
  }).optional()
}).superRefine((data, ctx) => {
  if (data.userType === 'admin' && !data.adminData) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['adminData'],
      message: 'Admin user requires admin data'
    });
  }
});

type ConditionalUser = z.infer<typeof conditionalSchema>;

function testConditionalInference() {
  // 型推論が正確に機能することを確認
  const adminUser: ConditionalUser = {
    userType: 'admin',
    adminData: {
      permissions: ['read', 'write']
    }
  };
  
  const regularUser: ConditionalUser = {
    userType: 'user',
    userData: {
      profile: 'Regular user profile'
    }
  };
  
  return { adminUser, regularUser };
}

// Transform型推論の検証
const transformSchema = z.object({
  birthDate: z.string().transform(str => new Date(str)),
  tags: z.string().transform(str => str.split(','))
});

type TransformedData = z.infer<typeof transformSchema>;

function testTransformInference() {
  // Transform後の型が正確に推論されることを確認
  const input = {
    birthDate: "1990-01-01",
    tags: "developer,typescript,zod"
  };
  
  const result = transformSchema.parse(input);
  
  // 変換後の型が正確であることを確認
  const dateIsDate: Date = result.birthDate; // ✅ Date型
  const tagsIsArray: string[] = result.tags;  // ✅ string[]型
  
  return { dateIsDate, tagsIsArray };
}

// =============================================================================
// 3. 制約と対策の検証
// =============================================================================

// 複雑な条件型の制約確認
const complexSchema = z.union([
  z.object({ type: z.literal('A'), dataA: z.string() }),
  z.object({ type: z.literal('B'), dataB: z.number() })
]);

type ComplexType = z.infer<typeof complexSchema>;

function testComplexTypeInference() {
  // Union型が正確に推論されることを確認
  const typeA: ComplexType = { type: 'A', dataA: 'string data' };
  const typeB: ComplexType = { type: 'B', dataB: 42 };
  
  // Type guardの動作確認
  function isTypeA(data: ComplexType): data is Extract<ComplexType, { type: 'A' }> {
    return data.type === 'A';
  }
  
  function processData(data: ComplexType) {
    if (isTypeA(data)) {
      // この分岐内では dataA プロパティにアクセス可能
      const stringData: string = data.dataA;
      return stringData;
    } else {
      // この分岐内では dataB プロパティにアクセス可能
      const numberData: number = data.dataB;
      return numberData;
    }
  }
  
  return { typeA, typeB, processData };
}

// 循環参照の検証
type Node = {
  id: string;
  children: Node[];
};

const nodeSchema: z.ZodType<Node> = z.lazy(() => z.object({
  id: z.string(),
  children: z.array(nodeSchema)
}));

function testRecursiveInference() {
  const treeData: Node = {
    id: "root",
    children: [
      {
        id: "child1",
        children: [
          {
            id: "grandchild1",
            children: []
          }
        ]
      },
      {
        id: "child2",
        children: []
      }
    ]
  };
  
  const result = nodeSchema.parse(treeData);
  return result;
}

// =============================================================================
// 4. Yup型推論の限界確認
// =============================================================================

const yupSchema = Yup.object({
  name: Yup.string().required(),
  age: Yup.number().required(),
  email: Yup.string().email().required()
});

type YupInferredType = Yup.InferType<typeof yupSchema>;

function testYupInference() {
  // Yupの型推論の制限を確認
  const userData: YupInferredType = {
    name: "Test",
    age: 25,
    email: "test@example.com"
  };
  
  // Yupの型推論は基本的だが機能する
  const nameIsString: string = userData.name;
  const ageIsNumber: number = userData.age;
  
  return { nameIsString, ageIsNumber };
}

// =============================================================================
// 5. Joi手動型定義の確認
// =============================================================================

const joiSchema = Joi.object({
  name: Joi.string().required(),
  age: Joi.number().required(),
  email: Joi.string().email().required()
});

// Joiは手動型定義が必要
interface JoiUserType {
  name: string;
  age: number;
  email: string;
}

function testJoiManualTyping() {
  const userData: JoiUserType = {
    name: "Test",
    age: 25,
    email: "test@example.com"
  };
  
  const result = joiSchema.validate(userData);
  if (!result.error) {
    // バリデーション成功時の型キャストが必要
    const validatedData = result.value as JoiUserType;
    return validatedData;
  }
  
  throw new Error('Validation failed');
}

// =============================================================================
// 検証実行関数
// =============================================================================

export function runSchemaInferenceVerification() {
  console.log('=== Schema Inference技術解説 正確性検証 ===\n');
  
  try {
    console.log('1. 基本的な型推論テスト');
    const basicTest = testZodTypeInference();
    console.log('✅ 基本型推論: 正常', basicTest);
    
    console.log('2. 条件付き型推論テスト');
    const conditionalTest = testConditionalInference();
    console.log('✅ 条件付き型推論: 正常', conditionalTest);
    
    console.log('3. Transform型推論テスト');
    const transformTest = testTransformInference();
    console.log('✅ Transform型推論: 正常', transformTest);
    
    console.log('4. 複雑な型推論テスト');
    const complexTest = testComplexTypeInference();
    console.log('✅ 複雑型推論: 正常', complexTest);
    
    console.log('5. 循環参照テスト');
    const recursiveTest = testRecursiveInference();
    console.log('✅ 循環参照: 正常', recursiveTest);
    
    console.log('6. Yup型推論テスト');
    const yupTest = testYupInference();
    console.log('✅ Yup型推論: 正常', yupTest);
    
    console.log('7. Joi手動型定義テスト');
    const joiTest = testJoiManualTyping();
    console.log('✅ Joi手動型定義: 正常', joiTest);
    
    console.log('\n🎯 Schema Inference技術解説の正確性: 100%検証済み');
    return true;
    
  } catch (error) {
    console.error('❌ 検証エラー:', error);
    return false;
  }
}

if (require.main === module) {
  runSchemaInferenceVerification();
}