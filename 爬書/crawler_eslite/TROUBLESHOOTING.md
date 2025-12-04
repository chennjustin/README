# 誠品網站爬蟲問題分析與解決方案

## 問題描述

爬蟲無法從誠品網站的分類頁面中提取書籍資料，所有類別都返回 0 本書。

## 可能原因分析

### 1. JavaScript 動態載入內容（最可能）

**問題**：誠品網站可能使用 JavaScript（如 React、Vue.js 等框架）動態載入書籍列表。當使用 `requests` 取得 HTML 時，JavaScript 尚未執行，因此頁面中沒有書籍資料。

**判斷方法**：
- 檢查取得的 HTML 長度是否很短（< 10000 字元）
- 查看 HTML 中是否包含 "loading"、"spinner" 等關鍵字
- 手動在瀏覽器中查看網頁原始碼（右鍵 > 檢視原始碼），與爬蟲取得的 HTML 比較

**解決方案**：
- 使用 Selenium 或 Playwright 等工具模擬瀏覽器
- 等待 JavaScript 執行完成後再取得 HTML
- 尋找網站是否有 API 端點可以直接取得資料

### 2. HTML 結構與預期不符

**問題**：誠品網站的實際 HTML 結構可能與解析器中使用的 CSS 選擇器不匹配。

**判斷方法**：
- 執行 `debug_html.py` 腳本查看實際的 HTML 結構
- 檢查 HTML 中是否有產品連結，但使用不同的 class 名稱或結構

**解決方案**：
- 手動檢查一個分類頁面的 HTML 結構
- 更新 `eslite_parser.py` 中的選擇器以匹配實際結構
- 使用更通用的選擇器（如所有 `<a>` 標籤，然後過濾 URL 模式）

### 3. 反爬蟲機制

**問題**：網站可能檢測到爬蟲行為並返回空內容或錯誤頁面。

**判斷方法**：
- 檢查 HTTP 回應狀態碼是否為 200
- 查看回應的 HTML 是否包含錯誤訊息或驗證碼
- 檢查是否需要特定的 cookies 或 headers

**解決方案**：
- 增加更真實的 User-Agent 和 headers
- 使用 cookies（可能需要先訪問首頁）
- 增加請求之間的延遲時間
- 使用代理伺服器

### 4. URL 格式問題

**問題**：分類 URL 可能需要特定的參數或格式才能正確顯示內容。

**判斷方法**：
- 在瀏覽器中手動訪問分類 URL，確認可以正常顯示
- 檢查 URL 是否需要特定的查詢參數

**解決方案**：
- 確認 URL 格式正確
- 嘗試添加必要的查詢參數（如 `?page=1`）

### 5. 需要登入或特定權限

**問題**：某些內容可能需要登入帳號才能查看。

**判斷方法**：
- 檢查 HTML 中是否包含登入提示或權限錯誤訊息

**解決方案**：
- 實作登入功能（如果需要）
- 使用 session 維持登入狀態

## 建議的除錯步驟

### 步驟 1：檢查 HTML 內容

執行以下命令來查看實際取得的 HTML：

```bash
cd crawler_eslite
python3 debug_html.py
```

這會：
- 取得第一個分類頁面的 HTML
- 儲存 HTML 到 `debug_html_output.html` 檔案
- 分析 HTML 結構並顯示統計資訊

### 步驟 2：手動檢查 HTML 檔案

打開 `debug_html_output.html`，檢查：
- HTML 是否包含書籍資料
- 書籍連結的格式是什麼
- 是否有明顯的容器元素包含書籍資訊

### 步驟 3：比較瀏覽器與爬蟲的 HTML

1. 在瀏覽器中訪問分類頁面（如：https://www.eslite.com/category/3/29）
2. 右鍵 > 檢視原始碼（或按 Ctrl+U / Cmd+Option+U）
3. 與爬蟲取得的 HTML 比較

如果瀏覽器的原始碼包含書籍資料，但爬蟲取得的沒有，則很可能是 JavaScript 動態載入的問題。

### 步驟 4：檢查網路請求

在瀏覽器中：
1. 打開開發者工具（F12）
2. 切換到 Network（網路）標籤
3. 重新載入分類頁面
4. 查看是否有 XHR/Fetch 請求載入書籍資料
5. 如果有，記錄該 API 端點的 URL 和參數

## 如果確認是 JavaScript 載入問題

需要使用 Selenium 或 Playwright：

### 使用 Selenium 的範例

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Chrome()
driver.get("https://www.eslite.com/category/3/29")

# 等待書籍元素載入
wait = WebDriverWait(driver, 10)
books = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "your-selector")))

html = driver.page_source
driver.quit()
```

### 使用 Playwright 的範例

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://www.eslite.com/category/3/29")
    
    # 等待內容載入
    page.wait_for_selector("your-selector", timeout=10000)
    
    html = page.content()
    browser.close()
```

## 已改進的功能

我已經對程式碼進行了以下改進：

1. **改進的解析器**：
   - 使用更多樣化的選擇器模式
   - 更積極地搜尋產品連結
   - 加入調試輸出以幫助診斷問題

2. **改進的客戶端**：
   - 添加 Referer header
   - 改進分頁處理
   - 加入 HTML 長度檢查

3. **調試工具**：
   - 建立 `debug_html.py` 用於分析 HTML 結構

## 下一步行動

1. 執行 `debug_html.py` 查看實際的 HTML 結構
2. 手動檢查一個分類頁面，確認書籍資料的載入方式
3. 根據發現的問題選擇適當的解決方案
4. 如果需要使用 Selenium/Playwright，我可以協助實作

