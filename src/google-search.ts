import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SearchResult, SearchResponse } from './types.js';
import { ContentFetcher } from './content-fetcher.js';
import axios from 'axios';

class GoogleSearchServer {
  private server: Server;
  private contentFetcher: ContentFetcher;

  constructor() {
    this.server = new Server({
      name: 'google-search',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {
          google_search: {
            description: 'Search Google and return relevant results from the web. This tool finds web pages, articles, and information on specific topics using Google\'s search engine. Results include titles, snippets, and URLs that can be analyzed further using extract_webpage_content.',
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
                },
                date_restrict: {
                  type: 'string',
                  description: 'Restrict results to a specific time period. Format: [d|w|m|y][number] e.g., "d1" (past day), "w2" (past 2 weeks), "m3" (past 3 months), "y1" (past year).'
                },
                language: {
                  type: 'string',
                  description: 'Restrict results to a specific language using ISO 639-1 codes. Examples: "en" (English), "es" (Spanish), "fr" (French), "de" (German), "ja" (Japanese).'
                },
                country: {
                  type: 'string',
                  description: 'Restrict results to a specific country using ISO 3166-1 alpha-2 codes. Examples: "us" (United States), "uk" (United Kingdom), "ca" (Canada), "au" (Australia).'
                },
                safe_search: {
                  type: 'string',
                  enum: ['off', 'medium', 'high'],
                  description: 'Safe search level: "off" (no filtering), "medium" (moderate filtering), "high" (strict filtering).'
                }
              },
              required: ['query']
            }
          },
          extract_webpage_content: {
            description: 'Extract and analyze content from a webpage, converting it to readable text. This tool fetches the main content while removing ads, navigation elements, and other clutter. Use it to get detailed information from specific pages found via google_search. Works with most common webpage formats including articles, blogs, and documentation.',
            inputSchema: {
              type: 'object',
              properties: {
                url: { 
                  type: 'string', 
                  description: 'Full URL of the webpage to extract content from (must start with http:// or https://). Ensure the URL is from a public webpage and not behind authentication.'
                }
              },
              required: ['url']
            }
          },
          extract_multiple_webpages: {
            description: 'Extract and analyze content from multiple webpages in a single request. This tool is ideal for comparing information across different sources or gathering comprehensive information on a topic. Limited to 5 URLs per request to maintain performance.',
            inputSchema: {
              type: 'object',
              properties: {
                urls: { 
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of webpage URLs to extract content from. Each URL must be public and start with http:// or https://. Maximum 5 URLs per request.'
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
          name: 'google_search',
          description: 'Search Google and return relevant results from the web. This tool finds web pages, articles, and information on specific topics using Google\'s search engine. Results include titles, snippets, and URLs that can be analyzed further using extract_webpage_content.',
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
              },
              date_restrict: {
                type: 'string',
                description: 'Restrict results to a specific time period. Format: [d|w|m|y][number] e.g., "d1" (past day), "w2" (past 2 weeks), "m3" (past 3 months), "y1" (past year).'
              },
              language: {
                type: 'string',
                description: 'Restrict results to a specific language using ISO 639-1 codes. Examples: "en" (English), "es" (Spanish), "fr" (French), "de" (German), "ja" (Japanese).'
              },
              country: {
                type: 'string',
                description: 'Restrict results to a specific country using ISO 3166-1 alpha-2 codes. Examples: "us" (United States), "uk" (United Kingdom), "ca" (Canada), "au" (Australia).'
              },
              safe_search: {
                type: 'string',
                enum: ['off', 'medium', 'high'],
                description: 'Safe search level: "off" (no filtering), "medium" (moderate filtering), "high" (strict filtering).'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'extract_webpage_content',
          description: 'Extract and analyze content from a webpage, converting it to readable text. This tool fetches the main content while removing ads, navigation elements, and other clutter. Use it to get detailed information from specific pages found via google_search. Works with most common webpage formats including articles, blogs, and documentation.',
          inputSchema: {
            type: 'object',
            properties: {
              url: { 
                type: 'string', 
                description: 'Full URL of the webpage to extract content from (must start with http:// or https://). Ensure the URL is from a public webpage and not behind authentication.'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'extract_multiple_webpages',
          description: 'Extract and analyze content from multiple webpages in a single request. This tool is ideal for comparing information across different sources or gathering comprehensive information on a topic. Limited to 5 URLs per request to maintain performance.',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of webpage URLs to extract content from. Each URL must be public and start with http:// or https://. Maximum 5 URLs per request.'
              }
            },
            required: ['urls']
          }
        }
      ]
    }));

    // Register tool call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      switch (request.params.name) {
        case 'google_search':
          if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'query' in request.params.arguments) {
            const args = request.params.arguments;
            return this.handleSearch({
              query: String(args.query),
              num_results: typeof args.num_results === 'number' ? args.num_results : undefined,
              date_restrict: typeof args.date_restrict === 'string' ? args.date_restrict : undefined,
              language: typeof args.language === 'string' ? args.language : undefined,
              country: typeof args.country === 'string' ? args.country : undefined,
              safe_search: typeof args.safe_search === 'string' ? args.safe_search : undefined
            });
          }
          throw new Error('Invalid arguments for google_search tool');

        case 'extract_webpage_content':
          if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'url' in request.params.arguments) {
            return this.handleAnalyzeWebpage({
              url: String(request.params.arguments.url)
            });
          }
          throw new Error('Invalid arguments for extract_webpage_content tool');

        case 'extract_multiple_webpages':
          if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'urls' in request.params.arguments && Array.isArray(request.params.arguments.urls)) {
            return this.handleBatchAnalyzeWebpages({
              urls: request.params.arguments.urls.map(String)
            });
          }
          throw new Error('Invalid arguments for extract_multiple_webpages tool');

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async handleSearch(args: { 
    query: string; 
    num_results?: number;
    date_restrict?: string;
    language?: string;
    country?: string;
    safe_search?: string;
  }) {
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
      const response = await axios.post<SearchResponse>('http://localhost:5002/search', {
        query: args.query,
        num_results: args.num_results || 5,
        date_restrict: args.date_restrict,
        language: args.language,
        country: args.country,
        safe_search: args.safe_search
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
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.status === 429 
          ? 'Search quota exceeded. Please try again later.'
          : `Search failed: ${error.response?.data?.error || error.message}`;
        
        return {
          content: [{ type: 'text', text: message }],
          isError: true
        };
      }
      if (error instanceof Error) {
        return {
          content: [{ type: 'text', text: `Search failed: ${error.message}` }],
          isError: true
        };
      }
      return {
        content: [{ type: 'text', text: 'Search failed: Unknown error' }],
        isError: true
      };
    }
  }

  private async handleAnalyzeWebpage(args: { url: string }) {
    // Validate URL format
    try {
      new URL(args.url);
    } catch {
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
    } catch (error: unknown) {
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

  private async handleBatchAnalyzeWebpages(args: { urls: string[] }) {
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
      } catch {
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
      const successfulUrls = Object.keys(results).filter(url => 
        results[url] && typeof results[url] === 'object' && Object.keys(results[url]).length > 0
      );

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to start MCP server:', error.message);
      } else {
        console.error('Failed to start MCP server: Unknown error');
      }
      process.exit(1);
    }
  }
}

// Start the server
const server = new GoogleSearchServer();
server.start().catch(console.error);
