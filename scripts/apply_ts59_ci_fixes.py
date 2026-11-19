#!/usr/bin/env python3
"""Apply TS 5.9 CI fixes to recommend routes and embedder."""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parents[1]

def patch(rel, old, new, label):
    p = root / rel
    s = p.read_text(encoding='utf-8')
    if new in s and old not in s:
        print(f'  = {label}: already applied')
        return
    if old not in s:
        print(f'  ! {label}: pattern not found in {rel}', file=sys.stderr)
        sys.exit(1)
    p.write_text(s.replace(old, new, 1), encoding='utf-8')
    print(f'  + {label}')

patch(
  'apps/api/src/routes/recommend-user.ts',
  """.filter((x: { id: string; score: number; embedding: Float32Array } | null): x is { id: string; score: number; embedding: Float32Array } => x !== null);

    // 5. SMMR diversity re-ranking
    const finalSelected = ail.smmr.rerank(smmrPool, limit);""",
  """.filter((x): x is { id: string; score: number; embedding: Float32Array } => x != null);

    // 5. SMMR diversity re-ranking
    const finalSelected = ail.smmr.rerank(smmrPool as { id: string; score: number; embedding: Float32Array }[], limit);""",
  'recommend-user SMMR pool',
)

patch(
  'apps/api/src/routes/recommend.ts',
  """.filter((x: { id: string; score: number; embedding: Float32Array } | null): x is { id: string; score: number; embedding: Float32Array } => x !== null);

  const finalSelected = ail.smmr.rerank(smmrPool, data.limit);""",
  """.filter((x): x is { id: string; score: number; embedding: Float32Array } => x != null);

  const finalSelected = ail.smmr.rerank(smmrPool as { id: string; score: number; embedding: Float32Array }[], data.limit);""",
  'recommend SMMR pool',
)

p = root / 'apps/api/src/services/embedder.ts'
s = p.read_text(encoding='utf-8')
s2 = s.replace(
    'const vec = new Float32Array(output.data);',
    'const vec = new Float32Array(output.data as ArrayLike<number>);',
    1,
)
s2 = s2.replace(
    'const vec = new Float32Array(output.data.slice(start, end));',
    'const vec = new Float32Array(output.data.slice(start, end) as ArrayLike<number>);',
    1,
)
if s2 == s:
    if 'as ArrayLike<number>' in s:
        print('  = embedder: already applied')
    else:
        print('  ! embedder patterns not found', file=sys.stderr)
        sys.exit(1)
else:
    p.write_text(s2, encoding='utf-8')
    print('  + embedder Float32Array casts')

print('OK')
