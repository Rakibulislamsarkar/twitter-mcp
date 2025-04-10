import { z } from "zod";

export const ConfigSchema = z.object({
  apiKey: z.string().min(1, "API Key is required"),
  apiSecretKey: z.string().min(1, "API Secret Key is required"),
  accessToken: z.string().min(1, "Access Token is required"),
  accessTokenSecret: z.string().min(1, "Access Token Secret is required"),
});

export type Config = z.infer<typeof ConfigSchema>;

export const PostTweetSchema = z.object({
  text: z
    .string()
    .min(1, "Tweet text cannot be empty")
    .max(500, "Tweet cannot exceed 500 characters"),
});

export type PostTweetArgs = z.infer<typeof PostTweetSchema>;

export const SearchTweetsSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
  count: z
    .number()
    .int("Count must be an integer")
    .min(10, "Minimum count is 10")
    .max(100, "Maximum count is 100"),
});

export type SearchTweetsArgs = z.infer<typeof SearchTweetsSchema>;

export interface TweetMetrics {
  likes: number;
  retweets: number;
}

export interface PostedTweet {
  id: string;
  text: string;
}

export interface TweetUser {
  id: string;
  username: string;
}

export interface Tweet {
  id: string;
  text: string;
  authorId: string;
  metrics: TweetMetrics;
  createdAt: string;
}