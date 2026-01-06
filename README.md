# AutoTestFlow

Domino E-Form 自動化測試專案，使用 Playwright 進行表單填寫、流程驗證與提交測試。

## 測試執行指令 (How to Run Tests)

本專案提供多種方式執行測試腳本，請依照需求選擇適合的指令。

### 1. 執行特定測試 (如 F079007M_Save)

這是最常用的方式，針對單一腳本進行測試。

*   **觀看瀏覽器操作 (Headed Mode)**
    適合除錯、觀察測試過程，會實際跳出瀏覽器視窗。
    ```bash
    npx playwright test tests/F079007M_Save.spec.js --headed
    ```

*   **不開啟瀏覽器 (Headless Mode)**
    速度較快，適合確認結果或在 CI/CD 背景執行 (預設模式)。
    ```bash
    npx playwright test tests/F079007M_Save.spec.js
    ```

### 2. 使用 Playwright UI 介面 (推薦)

Playwright 提供強大的互動式 UI，包含 Time Travel (時光機)、DOM Snapshot 與詳細 Log。
```bash
npx playwright test tests/F079007M_Save.spec.js --ui
```

### 3. 執行所有測試

若資料夾下有多個測試檔，想一次全部執行：
```bash
npx playwright test
```

### 4. 產生測試報告

測試完成後，可使用以下指令開啟 HTML 報告查看詳細結果：
```bash
npx playwright show-report
```
