# Google Search MCP Server

# MCPの概要と仕組み

**MCP（Model Context/Control Protocol）**は、AIモデル（例：ClaudeなどのLLM）と外部のデータソースやツールとの間で**安全な双方向通信**を実現するオープン標準プロトコルです。イメージとしてはAIアシスタントにUSB-Cハブを接続するようなもので、さまざまなデータソース（ローカルファイル、データベース、クラウドサービスなど）へのアクセスを**統一された方法**で提供します。これにより、AI開発者は個別のカスタム連携コードを毎回書く必要がなくなり、標準化された方法で新しいデータソースを追加できます。

## MCPアーキテクチャ

MCPは**クライアント-サーバーアーキテクチャ**で動作します。具体的には、以下のコンポーネントから成ります：

- **MCPホスト**: AIモデルを実行しMCP通信を行うプログラム（Claude Desktopや対応するIDE拡張など）
- **MCPクライアント**: ホスト内で動作し、MCPサーバーとの接続とメッセージ送受信を担う部品
- **MCPサーバー**: 各種データソースや機能へのアクセスを提供する軽量なアダプター
- **ローカルデータソース**: ユーザーPC上のファイルやDBなど
- **リモートサービス**: インターネット経由でアクセスする外部サービス

## 通信プロトコル

MCPは**JSON-RPC 2.0**に準拠したメッセージ交換を行います。通信の手順は次のようになります：

1. **初期化**: クライアントとサーバー間でプロトコルバージョンと機能の合意
2. **メッセージ交換**: リクエスト/レスポンス形式での機能呼び出し
3. **終了**: 明示的なシャットダウンまたはエラーによる終了

# Google Search MCPサーバーの実装

## 主要機能

このMCPサーバーは以下の機能を提供します：

1. Google Custom Search APIを使用したウェブ検索
2. 検索結果のコンテキスト抽出と要約
3. 高度な検索フィルタリングとパラメータ制御

## コアコンポーネント

```typescript
class GoogleSearchServer {
  private server: Server;
  private errorManager: ErrorManager;
  private validator: InputValidator;

  constructor() {
    this.server = new Server(
      {
        name: 'google-search-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {
            google_search: {
              description: 'Google検索を実行し結果を返す',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  num_results: { type: 'number', default: 5 },
                  language: { type: 'string', default: 'ja' }
                },
                required: ['query']
              }
            }
          }
        }
      }
    );

    this.setupHandlers();
  }

  private async handleSearch(params: SearchParams): Promise<SearchResult[]> {
    const response = await this.performGoogleSearch(params);
    return this.processSearchResults(response);
  }
}
```

# ユーザーガイド

## 前提条件

- Claude Desktop または VSCode with Cursor
- Google Custom Search API キー
- Google Custom Search Engine ID
- Node.js v14以上

## Google APIの設定

1. Google Cloud Consoleで新しいプロジェクトを作成
2. Custom Search APIを有効化
3. APIキーを生成
4. [Google Programmable Search Engine](https://programmablesearchengine.google.com/about/)で検索エンジンを作成
5. Search Engine IDを取得

## インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-username/google-search-mcp.git
cd google-search-mcp

# 依存パッケージのインストール
npm install

# ビルド
npm run build
```

## 設定

### Claude Desktop設定

`~/Library/Application Support/Claude/claude_desktop_config.json`を編集:

```json
{
  "mcpServers": {
    "google-search": {
      "command": "node",
      "args": ["/absolute/path/to/google-search-mcp/dist/google-search.js"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key",
        "GOOGLE_SEARCH_ENGINE_ID": "your-search-engine-id"
      },
      "disabled": false
    }
  }
}
```

### Cursor設定

`~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`を編集:

```json
{
  "mcpServers": {
    "google-search": {
      "command": "node",
      "args": ["/absolute/path/to/google-search-mcp/dist/google-search.js"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key",
        "GOOGLE_SEARCH_ENGINE_ID": "your-search-engine-id"
      },
      "disabled": false
    }
  }
}
```

## 使用方法

1. Claude Desktopを起動（または再起動）
2. チャットウィンドウ右下のハンマーアイコンで利用可能なツールを確認
3. 以下のような質問でGoogle検索を利用可能:
   - 「Model Context Protocolについて調べて」
   - 「最新のAI研究論文を探して」
   - 「プログラミング言語の人気ランキングを検索」

## トラブルシューティング

1. **サーバーが認識されない**
   - 設定ファイルのパスが正しいか確認
   - ビルドが成功しているか確認
   - ファイルの実行権限を確認

2. **検索が失敗する**
   - APIキーとSearch Engine IDの設定を確認
   - APIクォータの超過有無を確認
   - ネットワーク接続を確認

3. **結果が返ってこない**
   - ログファイルでエラーを確認
   - API制限に達していないか確認
   - クエリの形式が正しいか確認

## 制限事項

1. **API制限**
   - 無料版のGoogle Custom Search APIは1日あたり100クエリまで
   - 有料版は1日10,000クエリまで

2. **レスポンス制限**
   - 1回のクエリで最大10件まで取得可能
   - ページネーションは実装されていません

3. **コンテンツ制限**
   - 一部のウェブサイトは検索結果から除外される場合があります
   - PDFなどの特殊なコンテンツは完全にインデックスされない場合があります

## セキュリティ注意事項

1. **APIキーの保護**
   - APIキーを直接コードにハードコーディングしない
   - 環境変数として設定
   - 定期的なキーのローテーション

2. **アクセス制御**
   - 適切な実行権限の設定
   - 入力値の検証
   - レート制限の実装

3. **データ保護**
   - センシティブな検索クエリのログ制御
   - 個人情報を含む検索結果の取り扱い注意
   - キャッシュデータの適切な管理

# セットアップスクリプト

## macOS/Linux用セットアップスクリプト

`start-mcp.sh`:
```bash
#!/bin/bash

# 環境変数の読み込み
if [ -f "api-keys.json" ]; then
    export GOOGLE_API_KEY=$(cat api-keys.json | jq -r '.GOOGLE_API_KEY')
    export GOOGLE_SEARCH_ENGINE_ID=$(cat api-keys.json | jq -r '.GOOGLE_SEARCH_ENGINE_ID')
else
    echo "Error: api-keys.json not found"
    exit 1
fi

# 依存関係の確認とインストール
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# TypeScriptのビルド
echo "Building TypeScript..."
npm run build

# サーバーの起動
echo "Starting MCP server..."
node dist/google-search.js
```

## Windows用セットアップスクリプト

`start-all-servers.cmd`:
```batch
@echo off
setlocal enabledelayedexpansion

REM 環境変数の読み込み
if exist api-keys.json (
    for /f "tokens=* usebackq" %%a in (`type api-keys.json ^| jq -r .GOOGLE_API_KEY`) do (
        set "GOOGLE_API_KEY=%%a"
    )
    for /f "tokens=* usebackq" %%a in (`type api-keys.json ^| jq -r .GOOGLE_SEARCH_ENGINE_ID`) do (
        set "GOOGLE_SEARCH_ENGINE_ID=%%a"
    )
) else (
    echo Error: api-keys.json not found
    exit /b 1
)

REM 依存関係の確認とインストール
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

REM TypeScriptのビルド
echo Building TypeScript...
call npm run build

REM サーバーの起動
echo Starting MCP server...
node dist/google-search.js
```

## Docker対応

```dockerfile
FROM node:18-slim

WORKDIR /app

# 必要なファイルのコピー
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

# 依存関係のインストールとビルド
RUN npm ci
RUN npm run build

# 実行時の環境変数設定
ENV NODE_ENV=production

# サーバー起動
CMD ["node", "dist/google-search.js"]
```

Docker Compose設定:
```yaml
version: '3.8'
services:
  google-search-mcp:
    build: .
    environment:
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - GOOGLE_SEARCH_ENGINE_ID=${GOOGLE_SEARCH_ENGINE_ID}
    volumes:
      - ./api-keys.json:/app/api-keys.json:ro
    restart: unless-stopped
```

# ライセンス

MIT License

Copyright (c) 2025 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

# 貢献

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -am 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

# アップデート履歴

## v1.0.0 (2025-03-13)
- 初期リリース
- 基本的なGoogle検索機能の実装
- MCPプロトコル準拠のサーバー実装
- 詳細なドキュメントの追加

## v1.0.1 (2025-03-14)
- バグ修正: メモリリーク問題の解決
- パフォーマンス改善: キャッシュの実装
- ドキュメントの更新: トラブルシューティングセクションの拡充

# お問い合わせ

- Issue Tracker: https://github.com/your-username/google-search-mcp/issues
- Source Code: https://github.com/your-username/google-search-mcp

このプロジェクトは[MIT license](LICENSE)の下で公開されています。
