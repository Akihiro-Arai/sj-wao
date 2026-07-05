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

サイト本体とは別に、自宅メトリクス用の **Cloudflare Worker**（[`worker/`](./worker/README.md)）も同じ CI/CD に載っている。

- `.github/workflows/ci.yml` — 全ブランチへの push と `main` への PR で実行。ルート（`npm ci` → `npm test` → `npm run build`）と `worker/`（`npm ci` → `npm test` → `wrangler deploy --dry-run`）の両方を検証する（デプロイなし）。
- `.github/workflows/deploy.yml` — `main` への push で実行。`deploy` job が Pages を、`deploy-worker` job が Worker をそれぞれ独立してデプロイする（片方の失敗がもう片方を止めない）。

### 初回セットアップ（手動・1回だけ）

このリポジトリの CI からは Cloudflare ダッシュボードを操作できないため、以下は人手で行う必要がある。

1. Cloudflare Pages プロジェクトを作成する（`wrangler pages project create sj-wao`、またはダッシュボードから）。
2. **Pages用**: Pages:Edit 権限を持つ Cloudflare API トークンを発行し、GitHubリポジトリの Secret `CLOUDFLARE_API_TOKEN` に登録する（Settings → Secrets and variables → Actions）。
3. Cloudflare アカウントIDを Secret `CLOUDFLARE_ACCOUNT_ID` に登録する（Pages・Worker共通）。
4. これらの Secret が未設定のうちは `ci.yml`（ビルド検証）は push / PR のたびに成功するが、`deploy.yml` は失敗する。これは想定内の挙動。
5. 独自ドメイン（sj-wao用に取得予定のドメイン）は、Pages プロジェクト作成後に Cloudflareダッシュボードの Custom domains から手動で紐付ける。
6. **Worker用**: [`worker/README.md`](./worker/README.md) の手順で KV namespace 作成・`METRICS_TOKEN` secret 登録・初回 `wrangler deploy` を行う。
7. **Worker用トークン**: Pages用トークンとは別に、**Workers Scripts:Edit のみ**の権限を持つ Cloudflare API トークンを新規発行し、GitHubリポジトリの Secret `CLOUDFLARE_WORKER_API_TOKEN` に登録する（KV Storage系の権限は付与しない。KV namespace作成・secret登録は手順6で手動済みのため、CIはコードのdeployのみ行う）。

> `astro.config.mjs` の `site` は本番ドメイン `https://sj-wao.com` に設定済み（canonical URL・RSS・sitemap の生成元になる）。

## Admin（投稿UI）

記事の作成・編集用に、`admin/` に別アプリとして小さな管理画面を用意している。Cloudflare Pages にはデプロイせず、常時起動している自宅サーバー上で動かし、LAN内またはTailscale経由でのみアクセスする想定。保存すると自動で `git commit` / `push` まで行い、それが `main` への push として `.github/workflows/deploy.yml` の実行（＝ Cloudflare Pages への反映）を引き金にする。

セットアップ・起動方法は [`admin/README.md`](./admin/README.md) を参照。
