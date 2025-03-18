import { google } from 'googleapis';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ContentFetcher } from './content-fetcher.js';
class GoogleSearchServer {
    constructor() {
        this.apiKey = '';
        this.searchEngineId = '';
        this.isConnected = false;
        this.contentFetcher = new ContentFetcher();
        this.mcpServer = new Server({
            name: 'google-search',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {
                    google_search: {
                        description: 'Perform a Google search',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: { type: 'string', description: 'Search query' },
                                num_results: { type: 'number', description: 'Number of results (max 10)' },
                                date_restrict: { type: 'string', description: 'Date restriction (e.g., d1, w2, m3, y1)' },
                                language: { type: 'string', description: 'Language code (e.g., en, ja)' },
                                country: { type: 'string', description: 'Country code (e.g., us, jp)' },
                                safe_search: { type: 'string', enum: ['off', 'medium', 'high'] }
                            },
                            required: ['query']
                        }
                    },
                    analyze_page: {
                        description: 'Analyze the content of a webpage',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                url: { type: 'string', description: 'URL of the webpage to analyze' }
                            },
                            required: ['url']
                        }
                    }
                }
            }
        });
        this.initializeGoogleSearch();
    }
    loadSettings() {
        try {
            this.apiKey = process.env.GOOGLE_API_KEY || '';
            this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
            if (!this.apiKey || !this.searchEngineId) {
                throw new McpError(ErrorCode.InternalError, '環境変数 GOOGLE_API_KEY と GOOGLE_SEARCH_ENGINE_ID が必要です。設定ファイルで指定してください。');
            }
            this.initializeGoogleSearch();
        }
        catch (err) {
            if (err instanceof McpError) {
                throw err;
            }
            const error = err;
            console.error('Failed to load settings:', error.message);
            throw new McpError(ErrorCode.InternalError, '設定の読み込みに失敗しました: ' + error.message);
        }
    }
    initializeGoogleSearch() {
        this.searchService = google.customsearch('v1');
    }
    async performSearch(query, numResults = 10, dateRestrict, language, country, safeSearch) {
        try {
            const searchParams = {
                q: query,
                cx: this.searchEngineId,
                auth: this.apiKey,
                num: Math.min(numResults, 10)
            };
            if (dateRestrict)
                searchParams.dateRestrict = dateRestrict;
            if (language)
                searchParams.lr = `lang_${language}`;
            if (country)
                searchParams.cr = `country${country.toUpperCase()}`;
            if (safeSearch)
                searchParams.safe = safeSearch;
            const response = await this.searchService.cse.list(searchParams);
            const items = response.data.items || [];
            return items.map((item) => ({
                title: item.title || '',
                link: item.link || '',
                snippet: item.snippet || '',
                pagemap: item.pagemap || {},
                datePublished: item.pagemap?.metatags?.[0]?.['article:published_time'] || '',
                source: 'google_search'
            }));
        }
        catch (err) {
            console.error('Search error:', err);
            const error = err;
            // Google API特有のエラー処理
            if (error.response) {
                switch (error.response.status) {
                    case 400:
                        throw new McpError(ErrorCode.InvalidRequest, '検索クエリが無効です。検索条件を確認してください。');
                    case 403:
                        throw new McpError(ErrorCode.InvalidRequest, 'APIキーが無効か、APIの利用制限に達しました。');
                    case 429:
                        throw new McpError(ErrorCode.InternalError, 'APIの利用制限に達しました。しばらく待ってから再試行してください。');
                    default:
                        throw new McpError(ErrorCode.InternalError, `検索サービスでエラーが発生しました: ${error.response.data || error.message}`);
                }
            }
            // その他のエラー
            throw new McpError(ErrorCode.InternalError, `検索中にエラーが発生しました: ${error.message}`);
        }
    }
    initializeMcpHandlers() {
        this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const args = request.params.arguments;
                switch (request.params.name) {
                    case 'google_search':
                        const searchResults = await this.performSearch(args.query, args.num_results || 10, args.date_restrict, args.language, args.country, args.safe_search);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(searchResults, null, 2) }]
                        };
                    case 'analyze_page':
                        console.log('Attempting to analyze URL:', args.url);
                        let analysis;
                        try {
                            analysis = await this.contentFetcher.fetchAndAnalyze(args.url);
                            console.log('Analysis successful');
                            console.log('Full content length:', analysis.text.length);
                            console.log('First 500 characters:', analysis.text.substring(0, 500));
                        }
                        catch (err) {
                            console.error('Error in fetchAndAnalyze:', err);
                            const message = err instanceof Error ? err.message : String(err);
                            // エラーメッセージをユーザーフレンドリーに変換
                            if (message.includes('ENOTFOUND')) {
                                throw new McpError(ErrorCode.InvalidRequest, `指定されたURL（${args.url}）が見つかりません。URLが正しいか確認してください。`);
                            }
                            if (message.includes('ECONNREFUSED')) {
                                throw new McpError(ErrorCode.InvalidRequest, `サーバーに接続できません。サイトが利用可能か確認してください。`);
                            }
                            if (message.includes('404')) {
                                throw new McpError(ErrorCode.InvalidRequest, `ページが見つかりません（404エラー）。URLが正しいか確認してください。`);
                            }
                            if (message.includes('403')) {
                                throw new McpError(ErrorCode.InvalidRequest, `アクセスが拒否されました（403エラー）。このページにはアクセスできません。`);
                            }
                            // その他のエラー
                            throw new McpError(ErrorCode.InternalError, `ページの解析中にエラーが発生しました: ${message}`);
                        }
                        if (!analysis) {
                            throw new Error('Analysis failed to produce results');
                        }
                        // 完全なレスポンスを文字列として構築
                        const fullResponse = {
                            title: analysis.title,
                            text: analysis.text,
                            metadata: analysis.metadata
                        };
                        console.log('Full response:', JSON.stringify(fullResponse, null, 2));
                        return {
                            content: [{
                                    type: 'text',
                                    text: JSON.stringify(fullResponse, null, 2)
                                }]
                        };
                    default:
                        throw new McpError(ErrorCode.InternalError, 'Invalid tool name');
                }
            }
            catch (err) {
                console.error('MCP request error:', err);
                // 既にMcpErrorの場合はそのまま投げる
                if (err instanceof McpError) {
                    throw err;
                }
                const error = err;
                const message = error.message || String(err);
                // エラーメッセージに基づいて適切なMcpErrorを生成
                if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
                    throw new McpError(ErrorCode.InvalidRequest, 'URLにアクセスできません。接続先が正しいか確認してください。');
                }
                if (message.includes('timeout')) {
                    throw new McpError(ErrorCode.InternalError, 'サーバーの応答がタイムアウトしました。後でもう一度お試しください。');
                }
                // デフォルトのエラー
                throw new McpError(ErrorCode.InternalError, `操作中にエラーが発生しました: ${message}`);
            }
        });
    }
    async start() {
        try {
            process.on('SIGINT', this.gracefulShutdown.bind(this));
            process.on('SIGTERM', this.gracefulShutdown.bind(this));
            await this.loadSettings();
            // MCPサーバーのエラーハンドリング設定
            this.mcpServer.onerror = (error) => {
                console.error('MCP Server error:', error);
                if (error instanceof McpError && error.code === ErrorCode.InternalError) {
                    this.gracefulShutdown();
                }
            };
            // MCPハンドラーの初期化
            this.initializeMcpHandlers();
            // MCPサーバーの接続
            const transport = new StdioServerTransport();
            await this.mcpServer.connect(transport);
            this.isConnected = true;
            console.log('Google Search MCP server started and connected successfully');
            // 接続状態の監視
            setInterval(() => {
                if (!this.isConnected) {
                    console.error('MCP connection lost');
                    this.gracefulShutdown();
                }
            }, 5000);
        }
        catch (error) {
            console.error('Failed to start server:', error);
            await this.gracefulShutdown();
        }
    }
    async gracefulShutdown() {
        console.log('Shutting down gracefully...');
        if (this.mcpServer) {
            await this.mcpServer.close();
        }
        process.exit(0);
    }
}
// サーバーの起動
const server = new GoogleSearchServer();
server.start().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
});
