<?php

declare(strict_types=1);

namespace Eidos\Connectors\Bitrix;

use InvalidArgumentException;

/**
 * Maps 1C-Bitrix Information Block Elements (CIBlockElement / D7) into the EIDOS Connector v1.0 schema
 * and prepares HTTP payloads compatible with POST /v1/catalog/upsert.
 */
class Mapper
{
    public const MAX_DESCRIPTION_LENGTH = 5000;
    public const WIRE_DESCRIPTION_LIMIT = 2000;

    /**
     * @param mixed $systemItem
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string, sku?: string}
     */
    public function mapFields(mixed $systemItem): array
    {
        if (is_object($systemItem) && method_exists($systemItem, 'toArray')) {
            $item = (array) $systemItem->toArray();
        } elseif (is_object($systemItem)) {
            $item = (array) $systemItem;
        } elseif (is_array($systemItem)) {
            $item = $systemItem;
        } else {
            throw new InvalidArgumentException('Bitrix systemItem must be an array or object');
        }

        $rawId = trim((string) ($item['ID'] ?? $item['ELEMENT_ID'] ?? $item['id'] ?? ''));
        if ($rawId === '') {
            throw new InvalidArgumentException('Bitrix item ID (ELEMENT_ID) cannot be empty');
        }

        $rawSku = trim((string) (
            $item['XML_ID']
            ?? $item['EXTERNAL_ID']
            ?? $item['PROPERTY_CML2_ARTICLE_VALUE']
            ?? $item['sku']
            ?? ''
        ));
        $sku = $rawSku !== '' ? $this->safeSubstr($this->cleanPlainText($rawSku, 100), 0, 100) : null;

        $rawTitle = (string) ($item['NAME'] ?? $item['title'] ?? '');
        $title = $this->cleanPlainText($rawTitle, 500);
        if ($title === '') {
            $title = 'Item #' . $rawId;
        }

        $rawDescription = (string) ($item['DETAIL_TEXT'] ?? $item['PREVIEW_TEXT'] ?? $item['description'] ?? '');
        $description = $this->cleanPlainText($rawDescription, self::MAX_DESCRIPTION_LENGTH);

        $rawCategory = (string) ($item['SECTION_NAME'] ?? $item['IBLOCK_SECTION_NAME'] ?? $item['category'] ?? 'General');
        $category = $this->cleanPlainText($rawCategory, 100);
        if ($category === '') {
            $category = 'General';
        }

        $rawPrice = $item['PRICE'] ?? $item['CATALOG_PRICE_1'] ?? $item['MIN_PRICE']['VALUE'] ?? $item['price'] ?? 0;
        $price = max(0.0, round((float) $rawPrice, 2));

        $rawQuantity = $item['QUANTITY'] ?? $item['CATALOG_QUANTITY'] ?? ($item['inStock'] ?? false ? 1 : 0);
        $inStock = ((float) $rawQuantity) > 0.0;

        $tags = $this->extractTags($item['TAGS'] ?? $item['tags'] ?? [], $item['PROPERTIES'] ?? []);
        foreach ($item as $k => $v) {
            if (is_string($k) && str_starts_with($k, 'PROPERTY_') && str_ends_with($k, '_VALUE') && is_scalar($v)) {
                $propVal = $this->cleanPlainText((string) $v, 80);
                if ($propVal !== '' && !in_array($propVal, $tags, true) && count($tags) < 16) {
                    $tags[] = $propVal;
                }
            }
        }

        $rawUrl = trim((string) ($item['DETAIL_PAGE_URL'] ?? $item['url'] ?? ('/catalog/item/' . rawurlencode($rawId) . '/')));
        $url = $this->sanitizeUrl($rawUrl);

        $rawImage = $this->resolveBitrixPicture($item['PREVIEW_PICTURE'] ?? $item['DETAIL_PICTURE'] ?? $item['imageUrl'] ?? null);

        $mapped = [
            'id' => $this->safeSubstr($rawId, 0, 100),
            'title' => $title,
            'description' => $description,
            'category' => $category,
            'price' => $price,
            'inStock' => $inStock,
            'tags' => $tags,
            'url' => $url,
            'imageUrl' => $rawImage,
        ];
        if ($sku !== null && $sku !== '') {
            $mapped['sku'] = $sku;
        }

        return $mapped;
    }

    /**
     * @param array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string, sku?: string} $mapped
     * @return array<string, mixed>
     */
    public function toUpsertPayload(array $mapped): array
    {
        // Do not pollute BM25/embeddings with synthetic __eidos_* tags; url/inStock/imageUrl/sku are dedicated fields.
        $userTags = array_values(array_unique(array_slice($mapped['tags'], 0, 16)));

        $payload = [
            'id' => (string) $mapped['id'],
            'title' => $mapped['title'],
            'description' => $this->safeSubstr($mapped['description'], 0, self::WIRE_DESCRIPTION_LIMIT),
            'category' => $mapped['category'],
            'url' => $mapped['url'],
            'inStock' => (bool) $mapped['inStock'],
            'tags' => $userTags,
        ];

        if (!empty($mapped['sku'])) {
            $payload['sku'] = (string) $mapped['sku'];
        }

        if ($mapped['price'] > 0) {
            $payload['price'] = $mapped['price'];
        }

        if (!empty($mapped['imageUrl'])) {
            $payload['imageUrl'] = $mapped['imageUrl'];
        }

        return $payload;
    }

    public function cleanPlainText(string $input, int $maxLength = self::MAX_DESCRIPTION_LENGTH): string
    {
        if ($input === '') {
            return '';
        }

        $spaced = preg_replace('/<\/(p|div|li|tr|h[1-6]|br)\s*>/i', ' ', $input) ?? $input;
        $spacedBr = preg_replace('/<br\s*\/?>/i', ' ', $spaced) ?? $spaced;
        $stripped = strip_tags($spacedBr);
        $decoded = html_entity_decode($stripped, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $normalized = trim(preg_replace('/\s+/u', ' ', $decoded) ?? $decoded);

        if ($this->safeStrlen($normalized) > $maxLength) {
            return $this->safeSubstr($normalized, 0, $maxLength);
        }

        return $normalized;
    }

    private function safeStrlen(string $str): int
    {
        if (function_exists('mb_strlen')) {
            return mb_strlen($str, 'UTF-8');
        }
        if (preg_match_all('/./us', $str, $matches) !== false) {
            return count($matches[0]);
        }
        return strlen($str);
    }

    private function safeSubstr(string $str, int $start, int $length): string
    {
        if (function_exists('mb_substr')) {
            return mb_substr($str, $start, $length, 'UTF-8');
        }
        if (preg_match_all('/./us', $str, $matches) !== false) {
            return implode('', array_slice($matches[0], $start, $length));
        }
        return substr($str, $start, $length);
    }

    /**
     * @param string|array<int, mixed> $rawTags
     * @param array<string, mixed> $properties
     * @return array<int, string>
     */
    private function extractTags(string|array $rawTags, array $properties = []): array
    {
        $parts = is_array($rawTags) ? $rawTags : explode(',', $rawTags);
        foreach ($properties as $prop) {
            if (is_array($prop) && isset($prop['VALUE'])) {
                $val = $prop['VALUE'];
                if (is_array($val)) {
                    foreach ($val as $subVal) {
                        if (is_scalar($subVal)) {
                            $parts[] = (string) $subVal;
                        }
                    }
                } elseif (is_scalar($val)) {
                    $parts[] = (string) $val;
                }
            } elseif (is_scalar($prop)) {
                $parts[] = (string) $prop;
            }
        }

        $clean = [];

        foreach ($parts as $tag) {
            $t = $this->cleanPlainText((string) $tag, 80);
            if ($t !== '' && !str_starts_with($t, '__eidos_')) {
                $clean[] = $t;
            }
            if (count($clean) >= 17) {
                break;
            }
        }

        return array_values(array_unique($clean));
    }

    private function resolveBitrixPicture(mixed $picture): ?string
    {
        if ($picture === null || $picture === '' || $picture === false) {
            return null;
        }

        if (is_array($picture) && isset($picture['SRC'])) {
            return $this->sanitizeUrl((string) $picture['SRC']);
        }

        if (is_numeric($picture) && class_exists('CFile') && is_callable(['CFile', 'GetPath'])) {
            /** @phpstan-ignore-next-line */
            $path = \CFile::GetPath((int) $picture);
            return is_string($path) && $path !== '' ? $this->sanitizeUrl($path) : null;
        }

        if (is_string($picture)) {
            return $this->sanitizeUrl($picture);
        }

        return null;
    }

    private function sanitizeUrl(string $url): string
    {
        $clean = trim(str_replace(["\r", "\n", "\0"], '', $url));
        return $clean !== '' ? $clean : '/';
    }
}
