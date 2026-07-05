# sj-wao-metrics worker

自宅サーバーの環境メトリクス（室温など）を受け取り、ダッシュボードページ（サイト本体側の `/dashboard`）に公開するための Cloudflare Worker + KV。

- `POST /api/metrics` — 自宅サーバーが1時間に1回、Bearerトークン付きで送信する
- `GET /api/metrics` — 公開エンドポイント。ダッシュボードページがfetchする

## セットアップ（初回のみ、手動）

このプロジェクトの GitHub Actions からは KV namespace の作成や secret 登録はできない。以下はリポジトリオーナーが手元で行う。

```sh
cd worker
npm install

# 1. KV namespace を作成する
npx wrangler kv namespace create METRICS
# 出力された id を wrangler.jsonc の kv_namespaces[0].id に貼り付ける
# （現在は "REPLACE_WITH_KV_NAMESPACE_ID" のプレースホルダーになっている）

# 2. 送信トークンを secret として登録する（本番用の値。自分で決めた十分に長いランダム文字列を使う）
npx wrangler secret put METRICS_TOKEN

# 3. デプロイする
npx wrangler deploy
```

デプロイ後に表示される `https://sj-wao-metrics.<subdomain>.workers.dev` が本番のAPIエンドポイント。

## ローカル開発・テスト

```sh
cd worker
npm install
cp .dev.vars.example .dev.vars   # ローカルテスト用のダミートークンを置く場所。.dev.vars はコミットしない
npm test                          # vitest（@cloudflare/vitest-pool-workers、実際にWorkers runtime上で実行）
npx wrangler dev                  # ローカルで動かして手動確認したい場合
```

## スモークテスト（デプロイ後）

```sh
TOKEN=<METRICS_TOKENに設定した値>
URL=https://sj-wao-metrics.<subdomain>.workers.dev

# トークン無し → 401
curl -i -X POST "$URL/api/metrics" -d '{"room_temp_c":26.5}'

# 正しいトークン、未知キー混在 → 200、room_temp_c のみ保存される
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$URL/api/metrics" -d '{"room_temp_c":26.5,"hack":"x"}'

# 公開GET → 200 + Cache-Control
curl -i "$URL/api/metrics"
```

## メトリクスを増やすとき

`src/index.ts` の `ALLOWED_METRICS` に列挙されたキーのみが受理される（アローリスト方式）。増やすときは:

1. `ALLOWED_METRICS` にキーを追記する
2. 公開してよいデータかどうかを必ず判断してから追加する
3. `npx wrangler deploy`（または main への push、#9 対応後は自動）

## 設計上の注意

- 全メトリクスは1つのKVキー（`latest`）に1つのJSONとして保存する（KVはキー単位課金のため）
- CORSは `https://sj-wao.com` と `http://localhost:4321`（開発用）のみ許可。`*.pages.dev` プレビュー環境からは意図的に弾かれる
- 送信間隔は1時間で確定（Cloudflare無料枠のKV書き込み上限1,000回/日を踏まえた設計）
