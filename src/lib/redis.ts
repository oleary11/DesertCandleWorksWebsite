import { Redis } from "@upstash/redis";

// Support both Vercel KV env vars and standard Upstash env vars
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = new Redis({
  url: url || "",
  token: token || "",
});