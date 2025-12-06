# Swagger 類型生成與驗證指南

本文件說明如何使用 Swagger 定義來生成和驗證前後端的 TypeScript 類型定義，確保 API 定義與實際使用的類型保持一致。

## 概述

本專案使用 Swagger/OpenAPI 規範來定義 API 的結構和資料模型。為了確保前後端的類型定義與 Swagger 定義保持一致，我們提供了兩個工具：

1. **類型生成工具** (`generate-types-from-swagger.ts`)：從 Swagger 定義自動生成 TypeScript 類型
2. **類型驗證工具** (`validate-types.ts`)：驗證現有的 TypeScript 類型是否與 Swagger 定義一致

## 工具說明

### 類型生成工具

類型生成工具會讀取後端的 Swagger 定義（`backend/src/config/swagger.ts`），並生成對應的 TypeScript 類型定義檔案。

**生成位置：** `frontend/src/types/generated/swagger.d.ts`

**使用方式：**

```bash
npm run generate:types
```

**注意事項：**

- 生成的檔案會自動覆蓋現有的 `swagger.d.ts`
- 生成的檔案包含註解標示為自動生成，不應手動編輯
- 如果後端 Swagger 定義有更新，需要重新執行此命令

### 類型驗證工具

類型驗證工具會比較 Swagger 定義與前端現有的 TypeScript 類型定義（`frontend/src/types/index.ts`），檢查兩者是否一致。

**使用方式：**

```bash
npm run validate:types
```

**驗證內容：**

- 檢查 Swagger 中定義的每個 schema 是否在前端類型中有對應的定義
- 檢查欄位名稱是否一致
- 檢查欄位類型是否相容
- 檢查必填欄位是否正確標記
- 檢查是否有額外的欄位（前端有但 Swagger 沒有）

**輸出說明：**

- `✓` 表示類型完全匹配
- `⚠` 表示類型在 Swagger 中存在但前端沒有對應定義
- `❌` 表示類型存在但有不一致的地方
- `ℹ` 表示類型在前端存在但 Swagger 中沒有（可能是故意的，例如前端專用的類型）

## 工作流程建議

### 開發新功能時

1. 在後端路由中添加或更新 Swagger 註解（`@swagger`）
2. 更新 `backend/src/config/swagger.ts` 中的 schema 定義（如需要）
3. 執行 `npm run generate:types` 生成新的類型定義
4. 執行 `npm run validate:types` 驗證類型一致性
5. 根據生成的類型更新前端程式碼

### 維護現有功能時

1. 定期執行 `npm run validate:types` 檢查類型是否仍然一致
2. 如果發現不一致，可以選擇：
   - 更新 Swagger 定義以匹配現有類型
   - 執行 `npm run generate:types` 重新生成類型並更新前端程式碼

### 在 CI/CD 流程中

建議在 CI/CD 流程中加入類型驗證步驟：

```yaml
# 範例：GitHub Actions
- name: Validate types
  run: npm run validate:types
```

這樣可以確保每次提交的程式碼都與 Swagger 定義保持一致。

## 生成的類型結構

生成的類型檔案包含以下內容：

### Schema 類型

Swagger 中定義的每個 schema 都會生成對應的 TypeScript interface：

```typescript
export interface Book {
  book_id: number;
  name: string;
  author: string;
  publisher: string;
  price: number;
  categories: BookCategory[];
  available_count: number;
  discount_rate?: number | null;
  estimated_min_rental_price?: number | null;
}
```

### API 回應類型

同時也會生成標準的 API 回應類型：

```typescript
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

## 在前端使用生成的類型

### 方式一：直接使用生成的類型

```typescript
import { Book, ApiResponse } from './types/generated/swagger';

async function fetchBook(id: number): Promise<ApiResponse<Book>> {
  const response = await fetch(`/api/books/${id}`);
  return response.json();
}
```

### 方式二：在現有類型中引用

在 `frontend/src/types/index.ts` 中，可以從生成的類型中匯出並重新命名：

```typescript
// Re-export generated types with aliases if needed
export { Book as SwaggerBook } from './generated/swagger';
export { Member as SwaggerMember } from './generated/swagger';
```

### 方式三：擴展生成的類型

如果需要在前端添加額外的欄位或方法，可以擴展生成的類型：

```typescript
import { Book } from './types/generated/swagger';

export interface BookWithMetadata extends Book {
  // Additional frontend-specific fields
  isFavorite?: boolean;
  lastViewed?: Date;
}
```

## 常見問題

### Q: 生成的類型與現有類型不一致怎麼辦？

A: 有兩種處理方式：
1. 如果 Swagger 定義是正確的，執行 `npm run generate:types` 重新生成，然後更新前端程式碼以使用新的類型
2. 如果現有類型是正確的，更新 Swagger 定義以匹配現有類型

### Q: 可以手動編輯生成的類型檔案嗎？

A: 不建議。生成的檔案會在下次執行 `npm run generate:types` 時被覆蓋。如果需要自訂類型，應該：
- 在 `frontend/src/types/index.ts` 中定義自訂類型
- 或擴展生成的類型（見上方「方式三」）

### Q: 驗證工具報告的差異都是問題嗎？

A: 不一定。有些差異可能是合理的：
- 前端可能有額外的類型用於 UI 狀態管理
- 某些欄位在前端可能是可選的，但在 Swagger 中是必填的（這需要根據實際情況判斷）

### Q: 如何處理 Swagger 中沒有但前端需要的類型？

A: 這些類型應該定義在 `frontend/src/types/index.ts` 中，而不是生成的檔案中。驗證工具會標記這些類型，但不會視為錯誤。

## 技術細節

### 類型對應規則

Swagger 類型到 TypeScript 類型的對應：

| Swagger 類型 | TypeScript 類型 |
|-------------|----------------|
| `string` | `string` |
| `number` | `number` |
| `integer` | `number` |
| `boolean` | `boolean` |
| `array` | `T[]` |
| `object` | `interface` 或 `type` |
| `null` | `null` 或 `T \| null` |

### 特殊處理

- **日期格式**：`format: date` 或 `format: date-time` 會生成 `string` 類型（因為 JSON 中的日期通常是字串）
- **可選欄位**：Swagger 中不在 `required` 陣列中的欄位會生成可選屬性（`field?: type`）
- **可為空欄位**：`nullable: true` 會生成聯合類型（`type | null`）
- **引用類型**：`$ref` 會解析為對應的 schema 名稱

## 相關檔案

- Swagger 配置：`backend/src/config/swagger.ts`
- 類型生成腳本：`scripts/generate-types-from-swagger.ts`
- 類型驗證腳本：`scripts/validate-types.ts`
- 生成的類型：`frontend/src/types/generated/swagger.d.ts`
- 前端類型定義：`frontend/src/types/index.ts`

