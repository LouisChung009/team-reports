This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 部署與環境備忘（Firebase Hosting + Next.js）

- Node 版本：請使用 20（或 16/18/22），避免 Node 24 造成 frameworks 部署警告。若已下載便攜版 Node 20，可用：
  ```powershell
  & "$env:USERPROFILE\node20\node-v20.18.0-win-x64\node.exe" "$env:APPDATA\npm\node_modules\firebase-tools\lib\bin\firebase.js" deploy --only hosting --project team-reports-15602
  ```
- 必要 API：已啟用 Cloud Functions / Cloud Run / Artifact Registry / Cloud Build / Storage / PubSub；若部署卡在啟用 Eventarc 限流，稍候 1–2 分鐘再重試，或手動到 GCP Marketplace 啟用：
  https://console.cloud.google.com/marketplace/product/google/eventarc.googleapis.com?project=team-reports-15602
- 部署指令（專案根目錄）：`firebase deploy --only hosting --project team-reports-15602`（需先 `firebase experiments:enable webframeworks`，已開過）。
- 站點網址：`https://team-reports-15602.web.app`
- Firestore 測試資料：若需重置，只保留 `members`，刪除 `meetings`（已清空）；可用 CLI：
  ```bash
  firebase firestore:delete --project team-reports-15602 /meetings --recursive --force
  ```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
