# scripts/post-metrics.mjs

自宅サーバーから1時間に1回、メトリクスを sj-wao-metrics Worker([`worker/`](../worker/README.md))にPOSTする送信スクリプト。Node 22想定、依存パッケージなし。

センサーからの実際の値の収集（`collectMetrics()`）はこのリポジトリのスコープ外で、オーナーが自宅サーバーの環境に合わせて実装する必要がある。それまでは `--dry-run` で疎通確認できる。

## セットアップ

### 1. シークレットファイルを置く

トークンをリポジトリにコミットしないこと。自宅サーバー上に、リポジトリ外のファイルとして置く:

```sh
mkdir -p ~/.config
cat > ~/.config/sj-wao-metrics.env <<'EOF'
export METRICS_URL="https://sj-wao-metrics.<subdomain>.workers.dev/api/metrics"
export METRICS_TOKEN="<worker側でwrangler secret putしたのと同じ値>"
EOF
chmod 600 ~/.config/sj-wao-metrics.env
```

### 2. ログ出力先を作る

```sh
mkdir -p ~/.local/state
```

### 3. crontabに登録する

```sh
crontab -e
```

以下を追記(パスは環境に合わせる):

```
0 * * * * . ~/.config/sj-wao-metrics.env && /usr/local/bin/node /path/to/sj-wao/scripts/post-metrics.mjs >> ~/.local/state/sj-wao-metrics.log 2>&1
```

- 送信間隔は1時間で確定(Cloudflare無料枠のKV書き込み上限1,000回/日を踏まえた設計)。短くする場合は [`worker/README.md`](../worker/README.md) の上限を再確認すること。
- 1回あたりのタイムアウトは30秒、次の起動まで1時間空くため、通常は多重起動防止(`flock`)は不要。必要なら以下のように挟める:

  ```
  0 * * * * . ~/.config/sj-wao-metrics.env && /usr/bin/flock -n /tmp/sj-wao-metrics.lock /usr/local/bin/node /path/to/sj-wao/scripts/post-metrics.mjs >> ~/.local/state/sj-wao-metrics.log 2>&1
  ```

## 動作確認(`--dry-run`)

`collectMetrics()` の代わりに、引数で渡したJSONをそのまま送信する。ソースコードを一時変更する確認方法は使わないこと。

```sh
export METRICS_URL="https://sj-wao-metrics.<subdomain>.workers.dev/api/metrics"
export METRICS_TOKEN="<トークン>"

node scripts/post-metrics.mjs --dry-run '{"room_temp_c":26.5,"room_humidity_pct":55}'

# 反映確認
curl -s "$METRICS_URL"
```

## テスト

```sh
node --test scripts/*.test.mjs
```

（`node --test scripts/` は動作するNodeバージョンとしないバージョンがある。動かない場合は上記のglob指定を使うこと。）
