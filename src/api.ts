import { TwitterApi } from "twitter-api-v2";
import { Config, PostedTweet } from "./types.js";

export class TwitterClient {
    private client: TwitterApi;
    private rateLimitMap = new Map<string, number>();

    constructor(config: Config) {
        this.client = new TwitterApi({
            appKey: config.apiKey,
            appSecret: config.apiSecretKey,
            accessToken: config.accessToken,
            accessSecret: config.accessTokenSecret,
        })
        console.error('Twitter api...')
    }

    async postTweet(text:string): Promise<PostedTweet>{
        try {
            const endpoint = 'tweets/create';
            await this.checkRateLimit(endpoint);
      
            const response = await this.client.v2.tweet(text);
      
            console.error(Tweet posted successfully with ID: ${response.data.id});
      
            return {
              id: response.data.id,
              text: response.data.text
            };
        } catch (error) {
            this.handleApiError(error)
        }
    }
}