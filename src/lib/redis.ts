import { kv } from "@vercel/kv";

// Export Vercel KV instance as redis for compatibility with existing code
export const redis = kv;