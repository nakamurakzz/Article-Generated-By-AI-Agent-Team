# TypeScript Validation Libraries Comparison

## 概要
このプロジェクトは、TypeScriptで利用可能な主要なバリデーションライブラリ（Zod、Yup、Joi）の技術的比較と実装例を提供します。

## 実測結果サマリー

### パフォーマンス結果 (Node.js v22.7.0, macOS ARM64)

| 操作 | Zod | Yup | Joi | 最速 |
|------|-----|-----|-----|------|
| 単一オブジェクト検証 (10,000回) | 22.38ms | 173.85ms | 60.94ms | **Zod** |
| 配列検証 (1,000要素) | 2.12ms | 23.06ms | 6.98ms | **Zod** |
| 部分検証 (10,000回) | 11.06ms | 0.64ms | 25.69ms | **Yup** |
| エラー処理 (5,000回) | 57.43ms | 1226.71ms | 69.71ms | **Zod** |
| スキーマ作成 (10,000回) | 78.03ms | 167.29ms | 293.11ms | **Zod** |

**総合パフォーマンス**: Zod > Joi > Yup

### 技術的特徴比較

| 特徴 | Zod | Yup | Joi |
|------|-----|-----|-----|
| **型安全性** | ★★★ | ★★☆ | ★☆☆ |
| **TypeScript統合** | ★★★ | ★★☆ | ★☆☆ |
| **パフォーマンス** | ★★★ | ★☆☆ | ★★☆ |
| **エラーメッセージ** | ★★☆ | ★★★ | ★★★ |
| **エコシステム** | ★★☆ | ★★★ | ★★★ |
| **学習コストl** | ★★☆ | ★★★ | ★★☆ |

## プロジェクト構造

```
src/
├── basic-examples.ts      # 基本的な使用例
├── error-handling.ts      # 高度なエラーハンドリング
├── type-safety.ts         # 型安全性テスト
├── benchmark.ts           # パフォーマンス実測
├── real-world-examples.ts # 実用的なコード例
└── index.ts              # エントリーポイント
```

## セットアップ

```bash
npm install
npm run dev      # 基本例実行
npm run benchmark # パフォーマンステスト実行
```

## 各ライブラリの特徴

### 1. Zod
- **TypeScript-first設計**で型推論が優秀
- **最高のパフォーマンス**
- transform機能で型変換が可能
- カスタムバリデーションが直感的

```typescript
const schema = z.object({
  name: z.string().min(1),
  age: z.number().positive()
});
type User = z.infer<typeof schema>; // 型が自動推論
```

### 2. Yup
- **React生態系**との優秀な親和性
- **豊富なエラーメッセージ**カスタマイズ
- **部分検証で最高性能**
- 非同期バリデーション対応

```typescript
const schema = Yup.object({
  name: Yup.string().min(1).required(),
  age: Yup.number().positive().required()
});
```

### 3. Joi
- **Node.js定番**の実績あるライブラリ
- **豊富な機能**と柔軟なカスタマイズ
- **詳細なエラー情報**
- エンタープライズでの採用実績

```typescript
const schema = Joi.object({
  name: Joi.string().min(1).required(),
  age: Joi.number().positive().required()
});
```

## 選択指針

### 🎯 Zodを選ぶべき場合
- TypeScript中心の新規プロジェクト
- 型安全性を最重視
- 高いパフォーマンスが必要
- モダンな開発体験を求める

### 🎯 Yupを選ぶべき場合
- React/Formikとの連携が必要
- 豊富なバリデーションライブラリが必要
- チームの学習コストを抑えたい
- 部分的なバリデーションが多い

### 🎯 Joiを選ぶべき場合
- Node.js/Express中心のプロジェクト
- 既存システムとの互換性が重要
- 豊富な機能と柔軟性が必要
- エンタープライズ環境での安定性を重視

## 実装のベストプラクティス

### 1. 再利用可能なバリデータ

```typescript
const commonValidators = {
  id: z.string().uuid(),
  email: z.string().email(),
  phoneNumber: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/)
};
```

### 2. カスタムバリデーション

```typescript
const schema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string()
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'パスワードが一致しません'
    });
  }
});
```

### 3. エラーハンドリング

```typescript
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown) {
  try {
    return { success: true, data: schema.parse(data) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    throw error;
  }
}
```

## 技術的考察

### パフォーマンス分析
- **Zod**: コンパイル時最適化とランタイム効率性の両立
- **Yup**: 部分検証に特化した最適化
- **Joi**: 機能豊富だがオーバーヘッドが大きい

### 型安全性
- **Zod**: TypeScript型システムとの完全統合
- **Yup**: InferType を使った型推論（限定的）
- **Joi**: 型アノテーションによる部分的サポート

### エコシステム
- **Zod**: 新興だが急速に成長
- **Yup**: React界隈で圧倒的シェア
- **Joi**: Node.js界隈での確固たる地位

## まとめ

TypeScriptプロジェクトで新規開発を行う場合、**Zod**が最も推奨されます。特に型安全性とパフォーマンスを重視する現代的なアプリケーション開発において、その優位性は明確です。

一方、既存のReactプロジェクトや、チームの学習コストを考慮する場合は**Yup**、Node.js中心のエンタープライズ環境では**Joi**も十分に価値のある選択肢です。

各ライブラリの特徴を理解し、プロジェクトの要件に最適な選択を行うことが重要です。