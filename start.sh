# 環境変数の設定
export GOOGLE_API_KEY="AIzaSyD2-xXQ9fCNLv_3FWYspMX2R3EoHOXKfh0"
export GOOGLE_SEARCH_ENGINE_ID="01cf5ab938c0e4831"

# 古いプロセスの終了
pkill -f "node build/google-search-unified.js" || true

# TypeScriptビルドの確認と実行
echo "Starting MCP server..."
if [ ! -f "build/google-search-unified.js" ]; then
    echo "Building TypeScript..."
    npm run build
fi

# MCPサーバーの起動
node build/google-search-unified.js &

# すべてのバックグラウンドプロセスを待機
wait

# 終了時の処理
function cleanup {
    echo "Shutting down servers..."
    pkill -f "node build/google-search-unified.js"
}

trap cleanup EXIT