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
     * Преобразует элемент инфоблока 1С-Битрикс в канонический формат EIDOS Connector v1.0.
     *
     * Маппинг полей:
     * - ID -> id
     * - NAME -> title
     * - DETAIL_TEXT (или PREVIEW_TEXT) -> description (без HTML, до 5000 символов)
     * - SECTION_NAME (или IBLOCK_SECTION_NAME) -> category
     * - PRICE (или CATALOG_PRICE_1) -> price
     * - QUANTITY > 0 (или CATALOG_QUANTITY > 0) -> inStock
     * - TAGS -> tags
     * - DETAIL_PAGE_URL -> url
     * - PREVIEW_PICTURE -> imageUrl
     *
     * @param mixed $systemItem Ассоциативный массив элемента Битрикс или объект D7
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string}
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

        $rawId = trim((string) ($item['ID'] ?? $item['id'] ?? ''));
        if ($rawId === '') {
            throw new InvalidArgumentException('Bitrix item ID cannot be empty');
        }

        $rawTitle = (string) ($item['NAME'] ?? $item['title'] ?? '');
        $title = $this->cleanPlainText($rawTitle, 500);
        if ($title === '') {
            $title = 'Item #' . $rawId;
        }

        // Предпочитаем детальное описание, при его отсутствии используем анонс
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

        $tags = $this->extractTags($item['TAGS'] ?? $item['tags'] ?? []);

        $rawUrl = trim((string) ($item['DETAIL_PAGE_URL'] ?? $item['url'] ?? ('/catalog/item/' . rawurlencode($rawId) . '/')));
        $url = $this->sanitizeUrl($rawUrl);

        $rawImage = $this->resolveBitrixPicture($item['PREVIEW_PICTURE'] ?? $item['DETAIL_PICTURE'] ?? $item['imageUrl'] ?? null);

        return [
            'id' => mb_substr($rawId, 0, 100, 'UTF-8'),
            'title' => $title,
            'description' => $description,
            'category' => $category,
            'price' => $price,
            'inStock' => $inStock,
            'tags' => $tags,
            'url' => $url,
            'imageUrl' => $rawImage,
        ];
    }

    /**
     * Формирует JSON-payload для POST /v1/catalog/upsert.
     * Сохраняет системные поля Битрикса (url, imageUrl, inStock) в мета-тегах,
     * чтобы не требовать изменений в ядре EIDOS (packages/core и routes/catalog.ts).
     *
     * @param array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string} $mapped
     * @return array<string, mixed>
     */
    public function toUpsertPayload(array $mapped): array
    {
        $userTags = array_slice($mapped['tags'], 0, 17);
        $metaTags = [
            '__eidos_instock:' . ($mapped['inStock'] ? '1' : '0'),
            '__eidos_url:' . $mapped['url'],
        ];
        if (!empty($mapped['imageUrl'])) {
            $metaTags[] = '__eidos_img:' . $mapped['imageUrl'];
        }

        $payload = [
            'id' => $mapped['id'],
            'title' => $mapped['title'],
            'description' => mb_substr($mapped['description'], 0, self::WIRE_DESCRIPTION_LIMIT, 'UTF-8'),
            'category' => $mapped['category'],
            'tags' => array_values(array_unique(array_merge($userTags, $metaTags))),
        ];

        // EIDOS upsertItemSchema requires price to be positive when provided
        if ($mapped['price'] > 0) {
            $payload['price'] = $mapped['price'];
        }

        return $payload;
    }

    /**
     * Очищает строку от HTML-тегов, декодирует сущности и обрезает до $maxLength символов UTF-8.
     */
    public function cleanPlainText(string $input, int $maxLength = self::MAX_DESCRIPTION_LENGTH): string
    {
        if ($input === '') {
            return '';
        }

        // Заменяем закрывающие блочные теги пробелами, чтобы слова не слипались после strip_tags
        $spaced = preg_replace('/<\/(p|div|li|tr|h[1-6]|br)\s*>/i', ' ', $input) ?? $input;
        $spacedBr = preg_replace('/<br\s*\/?>/i', ' ', $spaced) ?? $spaced;
        $stripped = strip_tags($spacedBr);
        $decoded = html_entity_decode($stripped, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $normalized = trim(preg_replace('/\s+/u', ' ', $decoded) ?? $decoded);

        if (mb_strlen($normalized, 'UTF-8') > $maxLength) {
            return mb_substr($normalized, 0, $maxLength, 'UTF-8');
        }

        return $normalized;
    }

    /**
     * @param string|array<int, mixed> $rawTags
     * @return array<int, string>
     */
    private function extractTags(string|array $rawTags): array
    {
        $parts = is_array($rawTags) ? $rawTags : explode(',', $rawTags);
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

        if (is_numeric($picture) && function_exists('CFile::GetPath')) {
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
