import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { TwitterClient } from './twitter-api.js';
import { ResponseFormatter } from './formatter.js';
import {
  Config,
  ConfigSchema,
  PostTweetSchema,
  SearchTweetsSchema,
  TwitterError
} from './types.js';
import dotenv from 'dotenv';

function loadConfig(): Config {
  dotenv.config();

  const config = {
    apiKey: process.env.API_KEY,
    apiSecretKey: process.env.API_SECRET_KEY,
    accessToken: process.env.ACCESS_TOKEN,
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET
  };

  const validationResult = ConfigSchema.safeParse(config);
  if (!validationResult.success) {
    console.error('Configuration validation failed:', validationResult.error.message);
    process.exit(1);
  }

  return validationResult.data;
}

class TwitterServer {
  private server: Server;
  private client: TwitterClient;

  constructor(private config: Config) {
    this.client = new TwitterClient(this.config);
    this.server = new Server(
      { name: 'twitter-mcp', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );
    this.setup();
  }

  private setup(): void {
    this.registerErrorHandlers();
    this.registerToolHandlers();
  }

  private registerErrorHandlers(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]:', error);
    };

    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
      await this.server.close();
      process.exit(0);
    });
  }

  private registerToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'post_tweet',
          description: 'Post a new tweet to Twitter',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The content of your tweet',
                maxLength: 280
              }
            },
            required: ['text']
          }
        } as Tool,
        {
          name: 'search_tweets',
          description: 'Search for tweets on Twitter',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              count: {
                type: 'number',
                description: 'Number of tweets to return (10-100)',
                minimum: 10,
                maximum: 100
              }
            },
            required: ['query', 'count']
          }
        } as Tool
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      const { name, arguments: args } = params;
      console.log(`Executing tool: ${name}`, args);

      try {
        switch (name) {
          case 'post_tweet':
            return await this.handlePostTweet(args);
          case 'search_tweets':
            return await this.handleSearchTweets(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  private async handlePostTweet(args: unknown): Promise<{ content: TextContent[] }> {
    const validationResult = PostTweetSchema.safeParse(args);
    if (!validationResult.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${validationResult.error.message}`
      );
    }

    const tweet = await this.client.postTweet(validationResult.data.text);
    return {
      content: [{
        type: 'text',
        text: `Tweet posted successfully!\nURL: https://twitter.com/status/${tweet.id}`
      }]
    };
  }

  private async handleSearchTweets(args: unknown): Promise<{ content: TextContent[] }> {
    const validationResult = SearchTweetsSchema.safeParse(args);
    if (!validationResult.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${validationResult.error.message}`
      );
    }

    const { tweets, users } = await this.client.searchTweets(
      validationResult.data.query,
      validationResult.data.count
    );

    const formattedResponse = ResponseFormatter.formatSearchResponse(
      validationResult.data.query,
      tweets,
      users
    );

    return {
      content: [{
        type: 'text',
        text: ResponseFormatter.toMcpResponse(formattedResponse)
      }]
    };
  }

  private handleError(error: unknown): { content: TextContent[] } {
    if (error instanceof McpError) {
      throw error;
    }

    if (error instanceof TwitterError) {
      if (TwitterError.isRateLimit(error)) {
        return {
          content: [{
            type: 'text',
            text: 'Rate limit exceeded. Please wait a moment before trying again.',
            isError: true
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Twitter API error: ${(error as TwitterError).message}`,
          isError: true
        }]
      };
    }

    console.error('Unexpected error:', error);
    throw new McpError(ErrorCode.InternalError, 'An unexpected error occurred');
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Twitter MCP server is running on stdio.');
  }
}


(async () => {
  try {
    const config = loadConfig();
    const server = new TwitterServer(config);
    await server.start();
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();