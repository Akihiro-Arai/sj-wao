# sj-wao

個人の技術ブログ・日々のメモ・Works（作品リンク）をまとめたサイト。[Astro](https://astro.build) の Content Collections で Markdown / MDX を管理している。

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command           | Action                                        |
| :----------------- | :--------------------------------------------- |
| `npm install`       | Installs dependencies                          |
| `npm run dev`       | Starts local dev server at `localhost:4321`    |
| `npm run build`     | Build your production site to `./dist/`        |
| `npm run preview`   | Preview your build locally, before deploying   |

## Hosting

公開サイトは **Cloudflare Pages** にホスティングしているが、デプロイは Cloudflare の Git 連携（自動ビルド）ではなく、**GitHub Actions** の CI/CD で行っている。

- `.github/workflows/ci.yml` — 全ブランチへの push と `main` への PR で実行。`npm ci` → `npm run build` によるビルド検証のみ（デプロイなし）。
- `.github/workflows/deploy.yml` — `main` への push で実行。`npm run build` した `dist/` を `cloudflare/wrangler-action` 経由で `wrangler pages deploy` し、Cloudflare Pages に反映する。

### 初回セットアップ（手動・1回だけ）

このリポジトリの CI からは Cloudflare ダッシュボードを操作できないため、以下は人手で行う必要がある。

1. Cloudflare Pages プロジェクトを作成する（`wrangler pages project create sj-wao`、またはダッシュボードから）。
2. Pages:Edit 権限を持つ Cloudflare API トークンを発行し、GitHubリポジトリの Secret `CLOUDFLARE_API_TOKEN` に登録する（Settings → Secrets and variables → Actions）。
3. Cloudflare アカウントIDを Secret `CLOUDFLARE_ACCOUNT_ID` に登録する。
4. これらの Secret が未設定のうちは `ci.yml`（ビルド検証）は push / PR のたびに成功するが、`deploy.yml` は失敗する。これは想定内の挙動。
5. 独自ドメイン（sj-wao用に取得予定のドメイン）は、Pages プロジェクト作成後に Cloudflareダッシュボードの Custom domains から手動で紐付ける。

> `astro.config.mjs` の `site` は現状プレースホルダー (`https://sj-wao.dev`) になっている。実際のドメインが決まったら、本番公開前に必ず正しい値へ差し替えること（canonical URL・RSS・sitemap に影響する）。

## Admin（投稿UI）

記事の作成・編集用に、`admin/` に別アプリとして小さな管理画面を用意している。Cloudflare Pages にはデプロイせず、常時起動している自宅サーバー上で動かし、LAN内またはTailscale経由でのみアクセスする想定。保存すると自動で `git commit` / `push` まで行い、それが `main` への push として `.github/workflows/deploy.yml` の実行（＝ Cloudflare Pages への反映）を引き金にする。

セットアップ・起動方法は [`admin/README.md`](./admin/README.md) を参照。
