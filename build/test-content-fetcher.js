import { ContentFetcher } from './content-fetcher.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
async function runTests() {
    console.log('=== ContentFetcher Tests ===');
    const fetcher = new ContentFetcher();
    // テストケース1: 正常系 - 実在するWebページ
    try {
        console.log('\nTest 1: Fetching content from a valid URL');
        const result = await fetcher.fetchAndAnalyze('https://example.com');
        console.log('✅ Success: Content fetched successfully');
        console.log('Title:', result.title);
        console.log('Content length:', result.text.length);
        console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    // テストケース2: 存在しないURL
    try {
        console.log('\nTest 2: Attempting to fetch from non-existent URL');
        await fetcher.fetchAndAnalyze('https://this-domain-does-not-exist-12345.com');
        console.error('❌ Error: Expected error but got success');
    }
    catch (error) {
        if (error instanceof McpError && error.code === ErrorCode.InvalidRequest) {
            console.log('✅ Success: Correctly handled non-existent domain');
        }
        else {
            console.error('❌ Error: Unexpected error type:', error);
        }
    }
    // テストケース3: 404エラー
    try {
        console.log('\nTest 3: Attempting to fetch non-existent page (404)');
        await fetcher.fetchAndAnalyze('https://example.com/non-existent-page');
        console.error('❌ Error: Expected 404 error but got success');
    }
    catch (error) {
        if (error instanceof McpError && error.code === ErrorCode.InvalidRequest) {
            console.log('✅ Success: Correctly handled 404 error');
        }
        else {
            console.error('❌ Error: Unexpected error type:', error);
        }
    }
    // テストケース4: 日本語コンテンツ
    try {
        console.log('\nTest 4: Fetching Japanese content');
        const result = await fetcher.fetchAndAnalyze('https://www.yahoo.co.jp');
        console.log('✅ Success: Japanese content fetched successfully');
        console.log('Title:', result.title);
        console.log('Content length:', result.text.length);
        console.log('First 200 characters:', result.text.substring(0, 200));
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    // テストケース5: 大きなページ
    try {
        console.log('\nTest 5: Fetching large page');
        const result = await fetcher.fetchAndAnalyze('https://ja.wikipedia.org/wiki/%E3%83%A1%E3%82%A4%E3%83%B3%E3%83%9A%E3%83%BC%E3%82%B8');
        console.log('✅ Success: Large page fetched successfully');
        console.log('Title:', result.title);
        console.log('Content length:', result.text.length);
        if (result.text.length < 1000) {
            console.warn('⚠️ Warning: Content might be too short for a large page');
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
// テストの実行
console.log('Starting ContentFetcher tests...');
runTests().catch(console.error);
