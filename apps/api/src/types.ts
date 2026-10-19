export interface FastifyEnv {
  PORT?: string;
  HOST?: string;
  EIDOS_API_KEY?: string;
  NODE_ENV?: string;
}

export interface StoredItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price?: number;
  metadata?: Record<string, string | number | boolean | string[] | undefined>;
  embedding: number[];
  normalizedVector?: Float32Array;
}
