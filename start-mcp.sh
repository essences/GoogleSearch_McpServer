#!/bin/bash

PID_FILE="/tmp/google-search-mcp.pid"

# 既存のプロセスをチェック
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Process already running with PID $OLD_PID"
        exit 1
    fi
    rm "$PID_FILE"
fi

# 新しいプロセスを起動
cd "$(dirname "$0")"
node dist/google-search.js &
echo $! > "$PID_FILE"

# プロセス終了時にPIDファイルを削除
trap "rm -f $PID_FILE" EXIT
wait