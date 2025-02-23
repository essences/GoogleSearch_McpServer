import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ContentFetcher } from './content-fetcher.js';
import axios from 'axios';
class GoogleSearchServer {
    constructor() {
        this.server = new Server({
            name: 'google-search',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {
                    search: {
                        description: 'Search Google and return relevant results. Use this tool to find web pages, articles, and information on specific topics. Results include titles, snippets, and URLs that can be analyzed further using analyze_webpage.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query - be specific and use quotes for exact matches. For best results, use clear keywords and avoid very long queries.'
                                },
                                num_results: {
                                    type: 'number',
                                    description: 'Number of results to return (default: 5, max: 10). Increase for broader coverage, decrease for faster response.'
                                }
                            },
                            required: ['query']
                        }
                    },
                    analyze_webpage: {
                        description: 'Analyze and extract content from a webpage. This tool fetches the main content, removing ads and navigation elements. Use it to get detailed information from specific pages found via search. Handles most common webpage formats including articles, blogs, and documentation.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                url: {
                                    type: 'string',
                                    description: 'Full URL of the webpage to analyze (must start with http:// or https://). Ensure the URL is from a public webpage and not behind authentication.'
                                }
                            },
                            required: ['url']
                        }
                    },
                    batch_analyze_webpages: {
                        description: 'Analyze and extract content from multiple webpages simultaneously. Ideal for comparing information across different sources or gathering comprehensive information on a topic. Limited to 5 URLs per request to maintain performance.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                urls: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Array of webpage URLs to analyze. Each URL must be public and start with http:// or https://. Maximum 5 URLs per request.'
                                }
                            },
                            required: ['urls']
                        }
                    }
                }
            }
        });
        this.contentFetcher = new ContentFetcher();
        // Register tool list handler
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'search',
                    description: 'Search Google and return relevant results. Use this tool to find web pages, articles, and information on specific topics. Results include titles, snippets, and URLs that can be analyzed further using analyze_webpage.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query - be specific and use quotes for exact matches. For best results, use clear keywords and avoid very long queries.'
                            },
                            num_results: {
                                type: 'number',
                                description: 'Number of results to return (default: 5, max: 10). Increase for broader coverage, decrease for faster response.'
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'analyze_webpage',
                    description: 'Analyze and extract content from a webpage. This tool fetches the main content, removing ads and navigation elements. Use it to get detailed information from specific pages found via search. Handles most common webpage formats including articles, blogs, and documentation.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'Full URL of the webpage to analyze (must start with http:// or https://). Ensure the URL is from a public webpage and not behind authentication.'
                            }
                        },
                        required: ['url']
                    }
                },
                {
                    name: 'batch_analyze_webpages',
                    description: 'Analyze and extract content from multiple webpages simultaneously. Ideal for comparing information across different sources or gathering comprehensive information on a topic. Limited to 5 URLs per request to maintain performance.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            urls: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Array of webpage URLs to analyze. Each URL must be public and start with http:// or https://. Maximum 5 URLs per request.'
                            }
                        },
                        required: ['urls']
                    }
                }
            ]
        }));
        // Register tool call handler
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            switch (request.params.name) {
                case 'search':
                    if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'query' in request.params.arguments) {
                        return this.handleSearch({
                            query: String(request.params.arguments.query),
                            num_results: typeof request.params.arguments.num_results === 'number' ? request.params.arguments.num_results : undefined
                        });
                    }
                    throw new Error('Invalid arguments for search tool');
                case 'analyze_webpage':
                    if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'url' in request.params.arguments) {
                        return this.handleAnalyzeWebpage({
                            url: String(request.params.arguments.url)
                        });
                    }
                    throw new Error('Invalid arguments for analyze_webpage tool');
                case 'batch_analyze_webpages':
                    if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'urls' in request.params.arguments && Array.isArray(request.params.arguments.urls)) {
                        return this.handleBatchAnalyzeWebpages({
                            urls: request.params.arguments.urls.map(String)
                        });
                    }
                    throw new Error('Invalid arguments for batch_analyze_webpages tool');
                default:
                    throw new Error(`Unknown tool: ${request.params.name}`);
            }
        });
    }
    async handleSearch(args) {
        // Validate input
        if (!args.query.trim()) {
            return {
                content: [{ type: 'text', text: 'Search query cannot be empty. Please provide specific keywords.' }],
                isError: true
            };
        }
        if (args.num_results && (args.num_results < 1 || args.num_results > 10)) {
            return {
                content: [{ type: 'text', text: 'Number of results must be between 1 and 10.' }],
                isError: true
            };
        }
        try {
            const response = await axios.post('http://localhost:5000/search', {
                query: args.query,
                num_results: args.num_results || 5,
            });
            if (!response.data.results?.length) {
                return {
                    content: [{
                            type: 'text',
                            text: 'No results found. Try:\n- Using different keywords\n- Removing quotes from non-exact phrases\n- Using more general terms'
                        }],
                    isError: true
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(response.data.results, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.status === 429
                    ? 'Search quota exceeded. Please try again later.'
                    : `Search failed: ${error.response?.data?.error || error.message}`;
                return {
                    content: [{ type: 'text', text: message }],
                    isError: true
                };
            }
            throw error;
        }
    }
    async handleAnalyzeWebpage(args) {
        // Validate URL format
        try {
            new URL(args.url);
        }
        catch {
            return {
                content: [{
                        type: 'text',
                        text: 'Invalid URL format. URL must start with http:// or https:// and be properly formatted.'
                    }],
                isError: true
            };
        }
        try {
            const content = await this.contentFetcher.fetchContent(args.url);
            if (!content || (typeof content === 'object' && Object.keys(content).length === 0)) {
                return {
                    content: [{
                            type: 'text',
                            text: 'No content could be extracted. This might be because:\n- The page requires authentication\n- The page is not publicly accessible\n- The content is dynamically loaded\n- The URL points to a non-HTML resource'
                        }],
                    isError: true
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(content, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const helpText = 'Common issues:\n- Check if the URL is accessible in a browser\n- Ensure the webpage is public\n- Try again if it\'s a temporary network issue';
            return {
                content: [
                    {
                        type: 'text',
                        text: `${errorMessage}\n\n${helpText}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async handleBatchAnalyzeWebpages(args) {
        // Validate number of URLs
        if (args.urls.length > 5) {
            return {
                content: [{
                        type: 'text',
                        text: 'Maximum 5 URLs allowed per request to maintain performance. Please reduce the number of URLs.'
                    }],
                isError: true
            };
        }
        // Validate URL formats
        const invalidUrls = args.urls.filter(url => {
            try {
                new URL(url);
                return false;
            }
            catch {
                return true;
            }
        });
        if (invalidUrls.length > 0) {
            return {
                content: [{
                        type: 'text',
                        text: `Invalid URL format for: ${invalidUrls.join(', ')}\nAll URLs must start with http:// or https:// and be properly formatted.`
                    }],
                isError: true
            };
        }
        try {
            const results = await this.contentFetcher.batchFetchContent(args.urls);
            // Check if any results were retrieved
            const successfulUrls = Object.keys(results).filter(url => results[url] && typeof results[url] === 'object' && Object.keys(results[url]).length > 0);
            if (successfulUrls.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: 'Could not extract content from any of the provided URLs. Common issues:\n- Pages require authentication\n- Pages are not publicly accessible\n- Content is dynamically loaded\n- URLs point to non-HTML resources'
                        }],
                    isError: true
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const helpText = 'Common issues:\n- Check if all URLs are accessible in a browser\n- Ensure all webpages are public\n- Try again if it\'s a temporary network issue\n- Consider reducing the number of URLs';
            return {
                content: [
                    {
                        type: 'text',
                        text: `${errorMessage}\n\n${helpText}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async start() {
        try {
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error('Google Search MCP server running');
            // Keep the process running
            process.on('SIGINT', () => {
                this.server.close().catch(console.error);
                process.exit(0);
            });
        }
        catch (error) {
            console.error('Failed to start MCP server:', error);
            process.exit(1);
        }
    }
}
// Start the server
const server = new GoogleSearchServer();
server.start().catch(console.error);
