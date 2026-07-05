---
title: 'TypeScriptの型パズルにハマった一日'
description: '条件付き型とテンプレートリテラル型でAPIレスポンスの型を絞り込もうとして、結局シンプルな型に落ち着いた話。'
pubDate: 'Jun 27 2026'
heroImage: '../../assets/blog-placeholder-4.jpg'
---

APIのレスポンスから、特定のフィールドが存在する場合だけ型を絞り込みたくて、条件付き型とテンプレートリテラル型を組み合わせて試行錯誤した。

```ts
type ExtractByStatus<T, S extends string> = T extends { status: S } ? T : never;
```

やりたいことはできたが、呼び出し側でエラーが出たときの型エラーメッセージが長大になり、読む気が失せる代物になった。結局、判別可能な union をそのまま使って `switch` で分岐する、素直な書き方に戻した。

型で表現できることと、型で表現すべきことは別。今回は完全に前者に寄りすぎていた、という反省が今日の学び。
