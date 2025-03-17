#!/bin/bash

# APIキーの設定を確認
if [ ! -f "api-keys.json" ]; then
    echo "Error: api-keys.json not found"
    exit 1
fi

# 古いプロセスの終了
pkill -f "python3 google_search.py"
pkill -f "python3 link_view.py"
pkill -f "node.*google-search.js"

# Pythonサーバーの起動
echo "Starting Python servers..."
python3 google_search.py &
python3 link_view.py &

# サーバーの起動を待機
sleep 2

# TypeScriptビルドの確認と実行
echo "Starting MCP server..."
if [ ! -f "build/google-search.js" ]; then
    echo "Building TypeScript..."
    npm run build
fi

# MCPサーバーの起動
node build/google-search.js &

# すべてのバックグラウンドプロセスを待機
wait

# 終了時の処理
function cleanup {
    echo "Shutting down servers..."
    pkill -f "python3 google_search.py"
    pkill -f "python3 link_view.py"
    pkill -f "node.*google-search.js"
}

trap cleanup EXIT