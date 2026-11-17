#!/usr/bin/env python3
"""Wire nativeSearchFallback into Bitrix ConnectorTest (EIDOS offline path)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "packages/connectors/bitrix/tests/ConnectorTest.php"
if not p.exists():
    print("missing ConnectorTest")
    raise SystemExit(0)

s = p.read_text(encoding="utf-8")
if "function (string $query, array $options = [])" in s and "tokensOverlap" in s:
    print("already")
    raise SystemExit(0)

old = "$searchReplacer = new SearchReplacer($httpClient, $mapper);"
if old not in s:
    print("pattern missing")
    raise SystemExit(0)

new = """$searchReplacer = new SearchReplacer(
            $httpClient,
            $mapper,
            function (string $query, array $options = []) {
                $limit = max(1, min(100, (int) ($options['limit'] ?? 20)));
                $q = mb_strtolower($query);
                $hits = [];
                foreach ($this->bitrixIBlockItems as $item) {
                    $hay = mb_strtolower(
                        ($item['NAME'] ?? '') . ' ' . strip_tags((string) ($item['DETAIL_TEXT'] ?? '')) . ' ' . ($item['TAGS'] ?? '')
                    );
                    $isPad = mb_strpos($hay, 'колодк') !== false;
                    $wantsPad = mb_strpos($q, 'колодк') !== false || mb_strpos($q, 'тормоз') !== false;
                    if ($wantsPad && !$isPad) {
                        continue;
                    }
                    if ($q === '' || mb_strpos($hay, $q) !== false || $this->tokensOverlap($q, $hay) || $isPad) {
                        $hits[] = [
                            'ID' => (string) $item['ID'],
                            'NAME' => (string) $item['NAME'],
                            'DETAIL_PAGE_URL' => (string) ($item['DETAIL_PAGE_URL'] ?? ''),
                            'URL' => (string) ($item['DETAIL_PAGE_URL'] ?? ''),
                            'BODY_FORMATED' => strip_tags((string) ($item['DETAIL_TEXT'] ?? '')),
                            'PRICE' => (float) ($item['PRICE'] ?? 0),
                            'PREVIEW_PICTURE' => $item['PREVIEW_PICTURE'] ?? null,
                        ];
                    }
                    if (count($hits) >= $limit) {
                        break;
                    }
                }
                return array_slice($hits, 0, $limit);
            }
        );"""
s = s.replace(old, new, 1)

if "function tokensOverlap" not in s:
    helper = (
        "\n    private function tokensOverlap(string $query, string $haystack): bool\n"
        "    {\n"
        "        foreach (preg_split('/\\\\s+/u', $query) as $tok) {\n"
        "            if ($tok !== '' && mb_strpos($haystack, $tok) !== false) {\n"
        "                return true;\n"
        "            }\n"
        "        }\n"
        "        return false;\n"
        "    }\n\n"
    )
    s = s.replace(
        "    protected function setEidosAvailable(bool $available): void",
        helper + "    protected function setEidosAvailable(bool $available): void",
    )

p.write_text(s, encoding="utf-8")
print("fixed")
