@echo off
echo Starting Google Search MCP Server...

REM Change to the correct directory
cd /d C:\MCP\GoogleSearch_McpServer-main

REM Start Python search server in a new window
start "Google Search API" cmd /k "python C:\MCP\GoogleSearch_McpServer-main\google_search.py"

REM Start Python link viewer in a new window
start "Link Viewer" cmd /k "python C:\MCP\GoogleSearch_McpServer-main\link_view.py"

REM Wait for Python servers to initialize
echo Waiting for Python servers to initialize...
timeout /t 3

REM Start Node.js MCP server
echo Starting Node.js MCP server...
node C:\MCP\GoogleSearch_McpServer-main\dist\google-search.js
