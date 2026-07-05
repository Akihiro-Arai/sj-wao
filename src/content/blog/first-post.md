---
title: 'Astro + Cloudflare Pages でブログ基盤を作り直した話'
description: 'Markdownで書けて、ビルドが速くて、無料枠で運用できる。その3条件でAstro + Cloudflare Pagesにたどり着いた経緯をまとめた。'
pubDate: 'Jul 03 2026'
heroImage: '../../assets/blog-placeholder-3.jpg'
---

これまで書き溜めていた技術メモを、ちゃんと自分のドメインで公開する場所に移すことにした。要件は「Markdownで書けること」「ビルドが速いこと」「無料枠で運用できること」の3つ。

候補はいくつかあったが、Content Collectionsでフロントマターの型チェックまでしてくれるAstroが一番しっくりきた。記事はすべて `src/content/blog/*.md` に置くだけで、フロントマターのスキーマはこんな感じで定義している。

```ts
// src/content.config.ts
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
    }),
});
```

デプロイ先はCloudflare Pages。GitHub連携でmainブランチにpushすると自動ビルドされ、PRごとにプレビューURLも発行される。ドメインは元々Cloudflareで管理していたので、ネームサーバーの設定変更が不要だったのも決め手になった。

一度書いた記事の置き場所を、もう二度と移したくない。というのが今回の一番の動機だった。次は投稿そのものを楽にする仕組みを整えていく。
