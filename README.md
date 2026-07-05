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

公開サイトは **Cloudflare Pages** で、この GitHub リポジトリと直接連携してデプロイしている。

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: `Astro`

> `astro.config.mjs` の `site` は現状プレースホルダー (`https://sj-wao.dev`) になっている。Cloudflare で実際にドメインを取得したら、本番公開前に必ず正しい値へ差し替えること（canonical URL・RSS・sitemap に影響する）。

## Admin（投稿UI）

記事の作成・編集用に、`admin/` に別アプリとして小さな管理画面を用意している。Cloudflare Pages にはデプロイせず、常時起動している自宅サーバー上で動かし、LAN内またはTailscale経由でのみアクセスする想定。保存すると自動で `git commit` / `push` まで行い、それが Cloudflare Pages の自動ビルドの引き金になる。

セットアップ・起動方法は [`admin/README.md`](./admin/README.md) を参照。
