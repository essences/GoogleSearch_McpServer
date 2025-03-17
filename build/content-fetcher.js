import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
export class ContentFetcher {
    async fetchAndAnalyze(url) {
        try {
            console.log('=== Debug: ContentFetcher.fetchAndAnalyze ===');
            console.log('Fetching URL:', url);
            const response = await axios.get(url, {
                responseType: 'text',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            console.log('Response type:', typeof response.data);
            if (typeof response.data !== 'string') {
                console.log('Response data format:', JSON.stringify(response.data).substring(0, 200));
                throw new Error('Unexpected response format: expected string but got ' + typeof response.data);
            }
            const html = response.data;
            console.log('HTML content length:', html.length);
            const dom = new JSDOM(html);
            const document = dom.window.document;
            // Extract title
            const title = document.title || '';
            // Extract metadata
            const metadata = {
                description: this.getMetaContent(document, 'description'),
                keywords: this.getMetaContent(document, 'keywords')?.split(',').map((k) => k.trim()),
                author: this.getMetaContent(document, 'author'),
                publishDate: this.getMetaContent(document, 'article:published_time') ||
                    this.getMetaContent(document, 'pubdate') ||
                    this.getMetaContent(document, 'date')
            };
            console.log('Starting content extraction...');
            console.log('Loading HTML with cheerio...');
            const $ = cheerio.load(html);
            console.log('Removing unnecessary elements...');
            try {
                $('script, style, noscript, iframe, img, svg, [class*="ad"], [class*="advertisement"]').remove();
            }
            catch (err) {
                console.error('Error removing elements:', err);
            }
            // コンテンツを探す優先順位付きセレクタ
            const contentSelectors = [
                'main',
                'article',
                '.content',
                '#content',
                '.post',
                '.entry',
                '.article',
                '[role="main"]',
                '#main-content',
                '.main-content',
                '.body-content',
                '[itemprop="articleBody"]',
                '.page-content'
            ];
            let mainContent = $();
            let maxLength = 0;
            contentSelectors.forEach(selector => {
                $(selector).each((_, element) => {
                    const content = $(element);
                    const length = content.text().length;
                    if (length > maxLength) {
                        maxLength = length;
                        mainContent = content;
                    }
                });
            });
            const contentHtml = mainContent.length ? mainContent.html() : $('body').html();
            console.log('Main content found:', mainContent.length > 0 ? 'yes' : 'no');
            console.log('Content length before conversion:', contentHtml?.length || 0);
            // メインコンテンツからテキストを直接抽出
            console.log('Starting text extraction...');
            let text = '';
            if (mainContent.length) {
                console.log('Using main content for extraction');
                const textParts = [];
                // 見出し要素を抽出（大文字で）
                mainContent.find('h1, h2, h3, h4, h5, h6').each((_, element) => {
                    const content = $(element).text().trim();
                    if (content) {
                        textParts.push(content.toUpperCase());
                    }
                });
                // 段落とリストを抽出
                mainContent.find('p, li').each((_, element) => {
                    const content = $(element).text().trim();
                    if (content) {
                        textParts.push(content);
                    }
                });
                text = textParts.join('\n\n');
            }
            // メインコンテンツが空か短すぎる場合は代替抽出を試みる
            if (text.length < 200) {
                console.log('Content too short, trying alternative extraction');
                const textParts = [];
                // bodyから直接テキストを抽出
                $('body').find('h1, h2, h3, h4, h5, h6, p, li').each((_, element) => {
                    const content = $(element).text().trim();
                    if (content) {
                        textParts.push(content);
                    }
                });
                text = textParts.join('\n\n');
            }
            // テキストのクリーニングと整形
            const cleanedText = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                // 重複行を削除
                .filter((line, index, array) => array.indexOf(line) === index)
                // URLや特殊文字のみの行を削除
                .filter(line => !line.match(/^(https?:\/\/|www\.|[^a-zA-Z0-9\s])+$/))
                .join('\n');
            // 詳細なデバッグ情報
            console.log('=== Content Analysis Debug ===');
            console.log('Original HTML size:', html.length);
            console.log('Main content found:', mainContent.length > 0);
            console.log('Main content tag:', mainContent.length > 0 ? mainContent.get(0)?.name || 'unknown' : 'none');
            console.log('Content HTML size:', contentHtml?.length || 0);
            console.log('Cleaned text size:', cleanedText.length);
            console.log('Sample of cleaned text:', cleanedText.substring(0, 200));
            console.log('=== End Debug ===');
            // テキストが極端に短い場合は最後の手段を試す
            if (cleanedText.length < 100) {
                console.log('Warning: Final text is very short, attempting raw text extraction');
                // body以下の全テキストノードから直接抽出
                const rawText = $('body')
                    .find('*')
                    .contents()
                    .map(function () {
                    if (this.type === 'text') {
                        const text = $(this).text().trim();
                        return text.length > 0 ? text : null;
                    }
                    return null;
                })
                    .get()
                    .filter((text) => text !== null)
                    .join('\n');
                if (rawText.length > cleanedText.length) {
                    console.log('Using raw text extraction:', rawText.length, 'characters');
                    return {
                        title,
                        text: rawText,
                        metadata
                    };
                }
            }
            return {
                title,
                text: cleanedText,
                metadata
            };
        }
        catch (error) {
            console.error('Error in fetchAndAnalyze:', error);
            // エラーハンドリング
            if (this.isAxiosError(error)) {
                throw this.handleAxiosError(error, url);
            }
            if (error instanceof Error) {
                if (error.message.includes('Unexpected response format')) {
                    throw new McpError(ErrorCode.InternalError, `ページの解析に失敗しました：サーバーからの応答形式が無効です。`, { message: error.message });
                }
                throw new McpError(ErrorCode.InternalError, `コンテンツの解析中にエラーが発生しました：${error.message}`, { originalError: error });
            }
            throw new McpError(ErrorCode.InternalError, `予期せぬエラーが発生しました。`, { error: String(error) });
        }
    }
    getMetaContent(document, name) {
        const metaElement = document.querySelector(`meta[name="${name}"]`) ||
            document.querySelector(`meta[property="og:${name}"]`) ||
            document.querySelector(`meta[property="${name}"]`);
        return metaElement?.getAttribute('content') || undefined;
    }
    isAxiosError(error) {
        return (typeof error === 'object' &&
            error !== null &&
            ('code' in error || 'response' in error || 'request' in error));
    }
    handleAxiosError(error, url) {
        if (error.code === 'ENOTFOUND') {
            return new McpError(ErrorCode.InvalidRequest, `指定されたURL（${url}）は存在しないか、アクセスできません。`, { code: error.code, originalUrl: url });
        }
        if (error.response) {
            switch (error.response.status) {
                case 404:
                    return new McpError(ErrorCode.InvalidRequest, `ページが見つかりません（404エラー）。URLが正しいか確認してください。`, { status: 404, url });
                case 403:
                    return new McpError(ErrorCode.InvalidRequest, `アクセスが拒否されました（403エラー）。このページにはアクセスできません。`, { status: 403, url });
                default:
                    return new McpError(ErrorCode.InternalError, `サーバーエラーが発生しました（${error.response.status}）。`, {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        url
                    });
            }
        }
        if (error.request) {
            return new McpError(ErrorCode.InternalError, `サーバーからの応答がありません。接続をご確認ください。`, { url });
        }
        // 想定外のエラー形式
        return new McpError(ErrorCode.InternalError, `予期せぬエラーが発生しました。`, { error: String(error) });
    }
}
