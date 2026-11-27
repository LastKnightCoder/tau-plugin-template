# Tau 外掛模板

這是 [Tau](https://taunote.app) 官方的外掛模板。用 TypeScript 和 React 寫外掛，建置成一個 ZIP，發布到外掛中心後，使用者在桌面、Android 和 iOS 上安裝使用。外掛可以為 Tau 新增頁面和入口、在首頁放面板、在文件中放自訂區塊、在白板上加元素、給 AI 提供工具、接入第三方儲存和語音服務，或者讀寫使用者的卡片和待辦。

模板內建一個能直接執行的計數器：點「增加並儲存」，數字按工作區儲存，下次開啟繼續使用。裝好後，桌面在側邊欄、手機在「我的」頂部的功能宮格裡找到「計數器」。

## 三步跑起來

1. 在 GitHub 上點「Use this template」建立自己的儲存庫，複製到本機。
2. 安裝相依套件並建置，`dist/` 下會生成外掛 ZIP：

   ```sh
   pnpm install --frozen-lockfile
   pnpm build
   ```

3. 把 ZIP 裝進 Tau 開發版，啟用後開啟「計數器」。步驟見[快速開始 · 在 Tau 裡除錯](docs/getting-started.md#在-tau-里调试)。

## 文件

- 線上閱讀：<https://taunote.app/developers/>
- 儲存庫裡的 [docs/](docs/README.md)：和官網同一份內容，從[快速開始](docs/getting-started.md)讀起。
- 用 AI 程式設計助手寫外掛時，讓它先讀 [AGENTS.md](AGENTS.md)。

## 發布自己的外掛

這份 README 會隨外掛套件顯示在外掛詳情頁的「說明」裡。改成自己的外掛後，把它重寫成給使用者看的說明：外掛能做什麼、怎麼開始、常見問題。寫法見[發布與更新](docs/release.md)。
