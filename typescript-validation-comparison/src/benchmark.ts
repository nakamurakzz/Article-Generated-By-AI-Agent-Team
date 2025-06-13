import { z } from 'zod';
import * as Yup from 'yup';
import Joi from 'joi';

// =============================================================================
// パフォーマンス実測テスト
// =============================================================================

// 共通テストデータ
const createTestData = (size: number) => {
  const data = [];
  for (let i = 0; i < size; i++) {
    data.push({
      id: `${i.toString().padStart(8, '0')}-${Math.random().toString(36).substring(2)}`,
      name: `Product ${i}`,
      email: `user${i}@example.com`,
      age: Math.floor(Math.random() * 80) + 18,
      price: Math.random() * 1000,
      category: ['electronics', 'clothing', 'books'][Math.floor(Math.random() * 3)],
      tags: ['tag1', 'tag2', 'tag3'].slice(0, Math.floor(Math.random() * 3) + 1),
      isActive: Math.random() > 0.5,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      metadata: {
        score: Math.random() * 100,
        comments: Array.from({ length: Math.floor(Math.random() * 5) }, (_, idx) => `comment ${idx}`)
      }
    });
  }
  return data;
};

// =============================================================================
// ZOD スキーマ
// =============================================================================
const zodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(18).max(100),
  price: z.number().positive(),
  category: z.enum(['electronics', 'clothing', 'books']),
  tags: z.array(z.string()).min(1),
  isActive: z.boolean(),
  createdAt: z.date(),
  metadata: z.object({
    score: z.number().min(0).max(100),
    comments: z.array(z.string())
  })
});

const zodArraySchema = z.array(zodSchema);

// =============================================================================
// YUP スキーマ
// =============================================================================
const yupSchema = Yup.object({
  id: Yup.string().min(1).required(),
  name: Yup.string().min(1).max(100).required(),
  email: Yup.string().email().required(),
  age: Yup.number().min(18).max(100).required(),
  price: Yup.number().positive().required(),
  category: Yup.string().oneOf(['electronics', 'clothing', 'books']).required(),
  tags: Yup.array().of(Yup.string().required()).min(1).required(),
  isActive: Yup.boolean().required(),
  createdAt: Yup.date().required(),
  metadata: Yup.object({
    score: Yup.number().min(0).max(100).required(),
    comments: Yup.array().of(Yup.string().required()).required()
  }).required()
});

const yupArraySchema = Yup.array().of(yupSchema.required());

// =============================================================================
// JOI スキーマ
// =============================================================================
const joiSchema = Joi.object({
  id: Joi.string().min(1).required(),
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  age: Joi.number().min(18).max(100).required(),
  price: Joi.number().positive().required(),
  category: Joi.string().valid('electronics', 'clothing', 'books').required(),
  tags: Joi.array().items(Joi.string()).min(1).required(),
  isActive: Joi.boolean().required(),
  createdAt: Joi.date().required(),
  metadata: Joi.object({
    score: Joi.number().min(0).max(100).required(),
    comments: Joi.array().items(Joi.string()).required()
  }).required()
});

const joiArraySchema = Joi.array().items(joiSchema);

// =============================================================================
// ベンチマーク関数
// =============================================================================
interface BenchmarkResult {
  library: string;
  operation: string;
  dataSize: number;
  timeMs: number;
  opsPerSecond: number;
  memoryUsedMB: number;
  success: boolean;
  errorCount?: number;
}

async function measurePerformance<T>(
  name: string,
  operation: string,
  dataSize: number,
  fn: () => Promise<T> | T
): Promise<BenchmarkResult> {
  const memoryBefore = process.memoryUsage().heapUsed;
  
  const startTime = performance.now();
  let success = true;
  let errorCount = 0;
  
  try {
    await fn();
  } catch (error) {
    success = false;
    errorCount = 1;
  }
  
  const endTime = performance.now();
  const memoryAfter = process.memoryUsage().heapUsed;
  
  const timeMs = endTime - startTime;
  const opsPerSecond = dataSize / (timeMs / 1000);
  const memoryUsedMB = (memoryAfter - memoryBefore) / 1024 / 1024;
  
  return {
    library: name,
    operation,
    dataSize,
    timeMs: Math.round(timeMs * 100) / 100,
    opsPerSecond: Math.round(opsPerSecond),
    memoryUsedMB: Math.round(memoryUsedMB * 100) / 100,
    success,
    errorCount
  };
}

// 単一オブジェクト検証ベンチマーク
async function benchmarkSingle(iterations: number): Promise<BenchmarkResult[]> {
  const testData = createTestData(1)[0];
  const results: BenchmarkResult[] = [];
  
  // ZOD
  results.push(await measurePerformance('Zod', 'Single Validation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      zodSchema.parse(testData);
    }
  }));
  
  // YUP
  results.push(await measurePerformance('Yup', 'Single Validation', iterations, async () => {
    for (let i = 0; i < iterations; i++) {
      await yupSchema.validate(testData);
    }
  }));
  
  // JOI
  results.push(await measurePerformance('Joi', 'Single Validation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      const result = joiSchema.validate(testData);
      if (result.error) throw result.error;
    }
  }));
  
  return results;
}

// 配列検証ベンチマーク
async function benchmarkArray(arraySize: number): Promise<BenchmarkResult[]> {
  const testData = createTestData(arraySize);
  const results: BenchmarkResult[] = [];
  
  // ZOD
  results.push(await measurePerformance('Zod', 'Array Validation', arraySize, () => {
    zodArraySchema.parse(testData);
  }));
  
  // YUP
  results.push(await measurePerformance('Yup', 'Array Validation', arraySize, async () => {
    await yupArraySchema.validate(testData);
  }));
  
  // JOI
  results.push(await measurePerformance('Joi', 'Array Validation', arraySize, () => {
    const result = joiArraySchema.validate(testData);
    if (result.error) throw result.error;
  }));
  
  return results;
}

// 部分的検証ベンチマーク（パーシャル）
async function benchmarkPartial(iterations: number): Promise<BenchmarkResult[]> {
  const partialData = { name: "Test Product", price: 99.99 };
  const results: BenchmarkResult[] = [];
  
  const zodPartialSchema = zodSchema.partial();
  const yupPartialSchema = yupSchema.partial();
  const joiPartialSchema = joiSchema.fork(Object.keys(joiSchema.describe().keys), (schema) => schema.optional());
  
  // ZOD Partial
  results.push(await measurePerformance('Zod', 'Partial Validation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      zodPartialSchema.parse(partialData);
    }
  }));
  
  // YUP Partial
  results.push(await measurePerformance('Yup', 'Partial Validation', iterations, async () => {
    for (let i = 0; i < iterations; i++) {
      await yupPartialSchema.validate(partialData);
    }
  }));
  
  // JOI Partial
  results.push(await measurePerformance('Joi', 'Partial Validation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      const result = joiPartialSchema.validate(partialData);
      if (result.error) throw result.error;
    }
  }));
  
  return results;
}

// エラー検証ベンチマーク
async function benchmarkErrors(iterations: number): Promise<BenchmarkResult[]> {
  const invalidData = {
    id: "", // invalid
    name: "", // invalid
    email: "invalid-email", // invalid
    age: 15, // invalid (< 18)
    price: -100, // invalid
    category: "invalid", // invalid
    tags: [], // invalid
    isActive: "not-boolean", // invalid
    createdAt: "invalid-date", // invalid
    metadata: {
      score: 150, // invalid (> 100)
      comments: "not-array" // invalid
    }
  };
  
  const results: BenchmarkResult[] = [];
  
  // ZOD Error handling
  results.push(await measurePerformance('Zod', 'Error Validation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      try {
        zodSchema.parse(invalidData);
      } catch (error) {
        // Expected error
      }
    }
  }));
  
  // YUP Error handling
  results.push(await measurePerformance('Yup', 'Error Validation', iterations, async () => {
    for (let i = 0; i < iterations; i++) {
      try {
        await yupSchema.validate(invalidData, { abortEarly: false });
      } catch (error) {
        // Expected error
      }
    }
  }));
  
  // JOI Error handling
  results.push(await measurePerformance('Joi', 'Error Validation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      const result = joiSchema.validate(invalidData, { abortEarly: false });
      // Expected to have errors
    }
  }));
  
  return results;
}

// スキーマ作成ベンチマーク
async function benchmarkSchemaCreation(iterations: number): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  
  // ZOD Schema Creation
  results.push(await measurePerformance('Zod', 'Schema Creation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(100),
        email: z.string().email(),
        age: z.number().min(18).max(100),
        price: z.number().positive()
      });
    }
  }));
  
  // YUP Schema Creation
  results.push(await measurePerformance('Yup', 'Schema Creation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      Yup.object({
        id: Yup.string().min(1).required(),
        name: Yup.string().min(1).max(100).required(),
        email: Yup.string().email().required(),
        age: Yup.number().min(18).max(100).required(),
        price: Yup.number().positive().required()
      });
    }
  }));
  
  // JOI Schema Creation
  results.push(await measurePerformance('Joi', 'Schema Creation', iterations, () => {
    for (let i = 0; i < iterations; i++) {
      Joi.object({
        id: Joi.string().min(1).required(),
        name: Joi.string().min(1).max(100).required(),
        email: Joi.string().email().required(),
        age: Joi.number().min(18).max(100).required(),
        price: Joi.number().positive().required()
      });
    }
  }));
  
  return results;
}

// 結果表示関数
function displayResults(title: string, results: BenchmarkResult[]) {
  console.log(`\n=== ${title} ===`);
  console.log('Library\t\tTime(ms)\tOps/sec\t\tMemory(MB)');
  console.log('-------\t\t--------\t-------\t\t----------');
  
  results.forEach(result => {
    const libraryPadded = result.library.padEnd(8);
    const timePadded = result.timeMs.toString().padEnd(8);
    const opsPadded = result.opsPerSecond.toString().padEnd(8);
    const memoryPadded = result.memoryUsedMB.toString().padEnd(8);
    
    console.log(`${libraryPadded}\t${timePadded}\t${opsPadded}\t${memoryPadded}`);
  });
  
  // 最速を特定
  const fastest = results.reduce((min, current) => 
    current.timeMs < min.timeMs ? current : min
  );
  console.log(`\nFastest: ${fastest.library} (${fastest.timeMs}ms)`);
}

// メインベンチマーク実行
export async function runBenchmarks() {
  console.log('🚀 Starting TypeScript Validation Libraries Benchmark');
  console.log('======================================================\n');
  
  console.log('Test Environment:');
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB allocated`);
  
  try {
    // 単一オブジェクト検証 (10,000回)
    console.log('\n📊 Running single object validation benchmark...');
    const singleResults = await benchmarkSingle(10000);
    displayResults('Single Object Validation (10,000 iterations)', singleResults);
    
    // 配列検証 (1,000要素)
    console.log('\n📊 Running array validation benchmark...');
    const arrayResults = await benchmarkArray(1000);
    displayResults('Array Validation (1,000 objects)', arrayResults);
    
    // 部分的検証 (10,000回)
    console.log('\n📊 Running partial validation benchmark...');
    const partialResults = await benchmarkPartial(10000);
    displayResults('Partial Validation (10,000 iterations)', partialResults);
    
    // エラー処理 (5,000回)
    console.log('\n📊 Running error handling benchmark...');
    const errorResults = await benchmarkErrors(5000);
    displayResults('Error Handling (5,000 iterations)', errorResults);
    
    // スキーマ作成 (10,000回)
    console.log('\n📊 Running schema creation benchmark...');
    const schemaResults = await benchmarkSchemaCreation(10000);
    displayResults('Schema Creation (10,000 iterations)', schemaResults);
    
    // 総合結果
    console.log('\n🏆 Performance Summary');
    console.log('======================');
    
    const allResults = [
      ...singleResults,
      ...arrayResults,
      ...partialResults,
      ...errorResults,
      ...schemaResults
    ];
    
    const libraries = [...new Set(allResults.map(r => r.library))];
    libraries.forEach(lib => {
      const libResults = allResults.filter(r => r.library === lib);
      const avgTime = libResults.reduce((sum, r) => sum + r.timeMs, 0) / libResults.length;
      const avgOps = libResults.reduce((sum, r) => sum + r.opsPerSecond, 0) / libResults.length;
      const avgMemory = libResults.reduce((sum, r) => sum + r.memoryUsedMB, 0) / libResults.length;
      
      console.log(`${lib}: Avg ${Math.round(avgTime)}ms, ${Math.round(avgOps)} ops/sec, ${Math.round(avgMemory * 100) / 100}MB`);
    });
    
  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}

if (require.main === module) {
  runBenchmarks();
}