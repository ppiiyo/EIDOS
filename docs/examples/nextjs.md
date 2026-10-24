# Next.js App Router Integration Example

Use EIDOS in Next.js 15 Server Components and Server Actions for zero-bundle-size server-side recommendations and instant feedback loops.

## 1. Server Component (`app/products/[id]/page.tsx`)

```tsx
import React from 'react';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

async function getRecommendations(itemId: string) {
  const res = await fetch(`${process.env.EIDOS_API_URL || 'http://localhost:3000'}/v1/recommend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.EIDOS_API_KEY || 'test-key',
    },
    body: JSON.stringify({
      item_id: itemId,
      strategy: 'adaptive',
      limit: 6,
    }),
    next: { revalidate: 60 },
  });

  if (!res.ok) return { recommendations: [], latencyMs: 0, cacheHit: false };
  return res.json();
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const { recommendations, latencyMs, cacheHit } = await getRecommendations(id);

  return (
    <section className="py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Recommended For You</h2>
        <span className="text-xs font-mono text-zinc-400">
          {latencyMs}ms ({cacheHit ? 'Redis Cache Hit' : 'Computed via HNSW'})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {recommendations.map((rec: any) => (
          <article key={rec.id} className="p-4 border rounded-lg">
            <h3 className="font-medium">{rec.title}</h3>
            <p className="text-sm text-zinc-500">{rec.category}</p>
            <p className="text-sm font-semibold mt-2">${rec.price}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

## 2. Server Action for Real-Time Feedback (`app/actions/feedback.ts`)

```ts
'use server';

export async function trackProductInteraction(
  userId: string,
  itemId: string,
  eventType: 'click' | 'like' | 'purchase'
) {
  await fetch(`${process.env.EIDOS_API_URL || 'http://localhost:3000'}/v1/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.EIDOS_API_KEY || 'test-key',
    },
    body: JSON.stringify({
      user_id: userId,
      item_id: itemId,
      event_type: eventType,
    }),
  });
}
```
