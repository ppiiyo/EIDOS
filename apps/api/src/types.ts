/// <reference path="./types/fastify.d.ts" />

export interface FastifyEnv {
  PORT?: string;
  HOST?: string;
  EIDOS_API_KEY?: string;
  EIDOS_SNAPSHOT_PATH?: string;
  NODE_ENV?: string;
}

export interface StoredItem {
  id: string;
  sku?: string;
  brand?: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number;
  inStock?: boolean;
  url?: string;
  imageUrl?: string | null;
  metadata?: Record<string, string | number | boolean | string[] | undefined>;
  embedding: number[] | Float32Array;
  normalizedVector?: Float32Array;
}
