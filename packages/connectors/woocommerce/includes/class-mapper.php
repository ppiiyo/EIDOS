<?php
/**
 * Field Mapper transforming WC_Product objects and WooCommerce REST API payloads
 * into canonical EIDOS Connector v1.0 schema (with Bitrix parity).
 *
 * @package Eidos\Connectors\WooCommerce
 */

declare(strict_types=1);

namespace Eidos\Connectors\WooCommerce;

use InvalidArgumentException;

/**
 * Class Mapper
 *
 * Technical: Implements mapFields() for both native WC_Product / WC_Product_Variation
 * instances and associative arrays returned by /wp-json/wc/v3/products and /variations.
 * Provides safe UTF-8 string operations with fallback when ext-mbstring is not installed.
 */
class Mapper
{
    public const MAX_TITLE_LENGTH = 500;
    public const MAX_DESCRIPTION_LENGTH = 5000;
    public const MAX_CATEGORY_LENGTH = 100;

    /**
     * Checks whether a WooCommerce product or variation has 'publish' status.
     * Draft, private, pending, and trash items must not be indexed into storefront search.
     *
     * @param mixed $product WC_Product instance or REST API array
     */
    public function isPublishedProduct($product): bool
    {
        if (is_object($product) && method_exists($product, 'get_status')) {
            $status = strtolower(trim((string) $product->get_status()));
            return $status === '' || $status === 'publish';
        }

        if (is_array($product) && isset($product['status'])) {
            $status = strtolower(trim((string) $product['status']));
            return $status === '' || $status === 'publish';
        }

        return true;
    }

    /**
     * Transforms a WooCommerce product (WC_Product object or REST API array)
     * into the canonical EIDOS Connector v1.0 item schema.
     *
     * Contract:
     * - id = (string) product_id or variation_id (consistent with WordPress post__in hydration)
     * - sku = product SKU (if present)
     * - category = primary product_cat name (additional categories are appended to tags)
     * - empty title falls back to "Product #{id}" unless strictEmptyTitle is enabled
     * - negative price is clamped to 0.0 (or throws if rejectNegativePrice is enabled)
     *
     * @param mixed                     $product       WC_Product instance or REST API product/variation array
     * @param array<string, mixed>|null $parentContext Optional parent product data when mapping a variation
     * @param array<string, mixed>      $options       Optional flags: strictEmptyTitle, rejectNegativePrice, enforcePublishStatus
     * @return array{id: string, sku?: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl: ?string}
     */
    public function mapFields($product, ?array $parentContext = null, array $options = []): array
    {
        if (!empty($options['enforcePublishStatus']) && !$this->isPublishedProduct($product)) {
            throw new InvalidArgumentException('Non-published WooCommerce product cannot be synced.');
        }

        if (is_object($product) && method_exists($product, 'get_id')) {
            return $this->mapFromWcProductObject($product, $parentContext, $options);
        }

        if (is_array($product)) {
            return $this->mapFromRestArray($product, $parentContext, $options);
        }

        throw new InvalidArgumentException('Product must be a WC_Product instance or WooCommerce REST API array.');
    }

    /**
     * Maps a native WC_Product / WC_Product_Variation instance.
     *
     * @param object                    $product
     * @param array<string, mixed>|null $parentContext
     * @param array<string, mixed>      $options
     * @return array{id: string, sku?: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl: ?string}
     */
    private function mapFromWcProductObject(object $product, ?array $parentContext = null, array $options = []): array
    {
        $productId = (int) $product->get_id();
        if ($productId <= 0) {
            throw new InvalidArgumentException('WC_Product ID must be a positive integer.');
        }

        $parentId = method_exists($product, 'get_parent_id') ? (int) $product->get_parent_id() : 0;
        $termTargetId = $parentId > 0 ? $parentId : $productId;

        $rawTitle = method_exists($product, 'get_name') ? (string) $product->get_name() : '';
        if ($rawTitle === '' && $parentContext !== null && !empty($parentContext['title'])) {
            $rawTitle = (string) $parentContext['title'];
        }
        $title = $this->cleanPlainText($rawTitle, self::MAX_TITLE_LENGTH);
        if ($title === '') {
            if (!empty($options['strictEmptyTitle'])) {
                throw new InvalidArgumentException(sprintf('Product %d title must not be empty.', $productId));
            }
            $title = sprintf('Product #%d', $productId);
        }

        $rawSku = method_exists($product, 'get_sku') ? trim((string) $product->get_sku()) : '';
        $sku = $rawSku !== '' ? $this->cleanPlainText($rawSku, 100) : '';

        $rawDescription = method_exists($product, 'get_description') ? (string) $product->get_description() : '';
        if ($rawDescription === '' && method_exists($product, 'get_short_description')) {
            $rawDescription = (string) $product->get_short_description();
        }
        if ($rawDescription === '' && $parentContext !== null && !empty($parentContext['description'])) {
            $rawDescription = (string) $parentContext['description'];
        }

        $strippedDesc = function_exists('wp_strip_all_tags')
            ? (string) wp_strip_all_tags($rawDescription)
            : strip_tags($rawDescription);
        $description = $this->cleanDescription($strippedDesc);

        $categoryNames = [];
        if (function_exists('wp_get_post_terms')) {
            $terms = wp_get_post_terms($termTargetId, 'product_cat', ['fields' => 'names']);
            if (is_array($terms)) {
                foreach ($terms as $termName) {
                    if (is_string($termName) && trim($termName) !== '') {
                        $categoryNames[] = $this->cleanPlainText($termName, self::MAX_CATEGORY_LENGTH);
                    }
                }
            }
        }
        $categoryNames = array_values(array_unique(array_filter($categoryNames, static fn(string $c): bool => $c !== '')));
        $category = !empty($categoryNames)
            ? $categoryNames[0]
            : (string) ($parentContext['category'] ?? 'Uncategorized');

        $rawPrice = method_exists($product, 'get_price') ? $product->get_price() : 0;
        $numericPrice = is_numeric($rawPrice) ? (float) $rawPrice : 0.0;
        if ($numericPrice < 0.0 && !empty($options['rejectNegativePrice'])) {
            throw new InvalidArgumentException(sprintf('Product %d has negative price: %s', $productId, (string) $rawPrice));
        }
        $price = max(0.0, round($numericPrice, 2));

        $inStock = method_exists($product, 'is_in_stock')
            ? (bool) $product->is_in_stock()
            : true;

        $tags = [];
        if (count($categoryNames) > 1) {
            foreach (array_slice($categoryNames, 1) as $extraCat) {
                $tags[] = $extraCat;
            }
        }
        if (function_exists('wp_get_post_terms')) {
            $rawTags = wp_get_post_terms($termTargetId, 'product_tag', ['fields' => 'names']);
            if (is_array($rawTags)) {
                foreach ($rawTags as $tagName) {
                    if (is_string($tagName) && trim($tagName) !== '') {
                        $tags[] = $this->cleanText($tagName);
                    }
                }
            }
        }
        if (empty($tags) && $parentContext !== null && !empty($parentContext['tags']) && is_array($parentContext['tags'])) {
            $tags = $parentContext['tags'];
        }

        if (method_exists($product, 'get_variation_attributes')) {
            $varAttrs = $product->get_variation_attributes();
            if (is_array($varAttrs)) {
                foreach ($varAttrs as $attrVal) {
                    if (is_scalar($attrVal) && trim((string) $attrVal) !== '') {
                        $tags[] = $this->cleanText((string) $attrVal);
                    }
                }
            }
        }
        if ($sku !== '') {
            $tags[] = '__eidos_sku:' . $sku;
        }
        $tags = array_values(array_unique(array_filter($tags, static fn(string $t): bool => $t !== '')));

        $url = '';
        if (function_exists('get_permalink')) {
            $permalink = get_permalink($productId);
            if (is_string($permalink)) {
                $url = $permalink;
            }
        }
        if ($url === '' && method_exists($product, 'get_permalink')) {
            $url = (string) $product->get_permalink();
        }

        $imageUrl = null;
        $imageId = method_exists($product, 'get_image_id') ? (int) $product->get_image_id() : 0;
        if ($imageId > 0 && function_exists('wp_get_attachment_url')) {
            $attUrl = wp_get_attachment_url($imageId);
            if (is_string($attUrl) && $attUrl !== '') {
                $imageUrl = $attUrl;
            }
        }
        if ($imageUrl === null && $parentContext !== null && !empty($parentContext['imageUrl'])) {
            $imageUrl = (string) $parentContext['imageUrl'];
        }

        $mapped = [
            'id' => (string) $productId,
            'title' => $title,
            'description' => $description,
            'category' => (string) $category,
            'price' => $price,
            'inStock' => $inStock,
            'tags' => $tags,
            'url' => $url,
            'imageUrl' => $imageUrl,
        ];
        if ($sku !== '') {
            $mapped['sku'] = $sku;
        }

        return $mapped;
    }

    /**
     * Maps a WooCommerce REST API (/wp-json/wc/v3/products or /variations) array.
     *
     * @param array<string, mixed>      $item
     * @param array<string, mixed>|null $parentContext
     * @param array<string, mixed>      $options
     * @return array{id: string, sku?: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl: ?string}
     */
    private function mapFromRestArray(array $item, ?array $parentContext = null, array $options = []): array
    {
        $rawId = $item['id'] ?? $item['product_id'] ?? $item['variation_id'] ?? '';
        $id = trim((string) $rawId);
        if ($id === '' || $id === '0') {
            throw new InvalidArgumentException('WooCommerce REST item id must not be empty.');
        }

        $rawName = (string) ($item['name'] ?? $item['title'] ?? '');
        $attrSummary = $this->extractRestAttributesSummary($item['attributes'] ?? []);
        if ($rawName === '' && $parentContext !== null && !empty($parentContext['title'])) {
            $rawName = (string) $parentContext['title'];
            if ($attrSummary !== '') {
                $rawName .= ' — ' . $attrSummary;
            }
        } elseif ($parentContext !== null && !empty($parentContext['title']) && $attrSummary !== '' && stripos($rawName, $attrSummary) === false) {
            $rawName = $rawName . ' (' . $attrSummary . ')';
        }

        $title = $this->cleanPlainText($rawName, self::MAX_TITLE_LENGTH);
        if ($title === '') {
            if (!empty($options['strictEmptyTitle'])) {
                throw new InvalidArgumentException(sprintf('Product %s title must not be empty.', $id));
            }
            $title = sprintf('Product #%s', $id);
        }

        $rawSku = isset($item['sku']) ? trim((string) $item['sku']) : '';
        $sku = $rawSku !== '' ? $this->cleanPlainText($rawSku, 100) : '';

        $rawDesc = (string) ($item['description'] ?? '');
        if ($rawDesc === '' && !empty($item['short_description'])) {
            $rawDesc = (string) $item['short_description'];
        }
        if ($rawDesc === '' && $parentContext !== null && !empty($parentContext['description'])) {
            $rawDesc = (string) $parentContext['description'];
        }

        $strippedDesc = function_exists('wp_strip_all_tags')
            ? (string) wp_strip_all_tags($rawDesc)
            : strip_tags($rawDesc);
        $description = $this->cleanDescription($strippedDesc);

        $catNames = [];
        if (!empty($item['categories']) && is_array($item['categories'])) {
            foreach ($item['categories'] as $cat) {
                if (is_array($cat) && !empty($cat['name'])) {
                    $catNames[] = $this->cleanPlainText((string) $cat['name'], self::MAX_CATEGORY_LENGTH);
                } elseif (is_string($cat) && trim($cat) !== '') {
                    $catNames[] = $this->cleanPlainText($cat, self::MAX_CATEGORY_LENGTH);
                }
            }
        }
        $catNames = array_values(array_unique(array_filter($catNames, static fn(string $c): bool => $c !== '')));
        // Primary category is the first product_cat; extra categories are preserved in tags
        $category = !empty($catNames)
            ? $catNames[0]
            : (string) ($item['category'] ?? ($parentContext['category'] ?? 'Uncategorized'));

        $rawPrice = $item['price'] ?? ($item['regular_price'] ?? ($item['sale_price'] ?? 0));
        if ($rawPrice === '' && $parentContext !== null && isset($parentContext['price'])) {
            $rawPrice = $parentContext['price'];
        }
        $numericPrice = is_numeric($rawPrice) ? (float) $rawPrice : 0.0;
        if ($numericPrice < 0.0 && !empty($options['rejectNegativePrice'])) {
            throw new InvalidArgumentException(sprintf('Product %s has negative price: %s', $id, (string) $rawPrice));
        }
        $price = max(0.0, round($numericPrice, 2));

        if (isset($item['stock_status'])) {
            $inStock = strtolower((string) $item['stock_status']) === 'instock';
        } elseif (isset($item['in_stock'])) {
            $inStock = (bool) $item['in_stock'];
        } elseif (isset($item['inStock'])) {
            $inStock = (bool) $item['inStock'];
        } else {
            $inStock = true;
        }

        $tags = [];
        if (count($catNames) > 1) {
            foreach (array_slice($catNames, 1) as $extraCat) {
                $tags[] = $extraCat;
            }
        }
        if (!empty($item['tags']) && is_array($item['tags'])) {
            foreach ($item['tags'] as $tag) {
                if (is_array($tag) && !empty($tag['name'])) {
                    $tags[] = $this->cleanText((string) $tag['name']);
                } elseif (is_string($tag) && trim($tag) !== '') {
                    $tags[] = $this->cleanText($tag);
                }
            }
        }
        if (empty($tags) && $parentContext !== null && !empty($parentContext['tags']) && is_array($parentContext['tags'])) {
            $tags = $parentContext['tags'];
        }
        if (!empty($item['attributes']) && is_array($item['attributes'])) {
            foreach ($item['attributes'] as $attr) {
                if (is_array($attr) && !empty($attr['option']) && is_scalar($attr['option'])) {
                    $tags[] = $this->cleanText((string) $attr['option']);
                }
            }
        }
        if ($sku !== '') {
            $tags[] = '__eidos_sku:' . $sku;
        }
        $tags = array_values(array_unique(array_filter($tags, static fn(string $t): bool => $t !== '')));

        $url = (string) ($item['permalink'] ?? $item['url'] ?? ($parentContext['url'] ?? ''));

        $imageUrl = null;
        if (!empty($item['image']) && is_array($item['image']) && !empty($item['image']['src'])) {
            $imageUrl = (string) $item['image']['src'];
        } elseif (!empty($item['images']) && is_array($item['images']) && isset($item['images'][0]['src'])) {
            $imageUrl = (string) $item['images'][0]['src'];
        } elseif (!empty($item['imageUrl']) && is_string($item['imageUrl'])) {
            $imageUrl = $item['imageUrl'];
        } elseif ($parentContext !== null && !empty($parentContext['imageUrl'])) {
            $imageUrl = (string) $parentContext['imageUrl'];
        }

        $mapped = [
            'id' => $id,
            'title' => $title,
            'description' => $description,
            'category' => $category,
            'price' => $price,
            'inStock' => $inStock,
            'tags' => $tags,
            'url' => $url,
            'imageUrl' => $imageUrl,
        ];
        if ($sku !== '') {
            $mapped['sku'] = $sku;
        }

        return $mapped;
    }

    /**
     * Builds the item payload for batch `POST /v1/catalog/upsert`.
     *
     * @param array{id: string, sku?: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string} $mapped
     * @return array<string, mixed>
     */
    public function toUpsertPayload(array $mapped): array
    {
        $payload = [
            'id' => (string) $mapped['id'],
            'title' => $mapped['title'],
            'description' => $mapped['description'],
            'category' => $mapped['category'] !== '' ? $mapped['category'] : 'General',
            'price' => $mapped['price'],
            'inStock' => $mapped['inStock'],
            'tags' => array_slice(array_values($mapped['tags']), 0, 20),
            'url' => $mapped['url'],
        ];

        if (!empty($mapped['sku'])) {
            $payload['sku'] = (string) $mapped['sku'];
        }

        if (!empty($mapped['imageUrl'])) {
            $payload['imageUrl'] = $mapped['imageUrl'];
        }

        return $payload;
    }

    /**
     * Cleans HTML and truncates text to max length using UTF-8 safe helpers.
     */
    public function cleanPlainText(string $raw, int $maxLength = 500): string
    {
        $clean = $this->cleanText($raw);
        if ($clean === '') {
            return '';
        }
        return self::safeSubstr($clean, 0, $maxLength);
    }

    /**
     * UTF-8 safe string length helper with fallback when ext-mbstring is not installed.
     */
    public static function safeStrlen(string $str): int
    {
        if (function_exists('mb_strlen')) {
            return (int) mb_strlen($str, 'UTF-8');
        }
        if (preg_match_all('/./us', $str, $matches) !== false) {
            return count($matches[0]);
        }
        return strlen($str);
    }

    /**
     * UTF-8 safe substring helper with fallback when ext-mbstring is not installed.
     */
    public static function safeSubstr(string $str, int $start, int $length): string
    {
        if (function_exists('mb_substr')) {
            return (string) mb_substr($str, $start, $length, 'UTF-8');
        }
        if (preg_match_all('/./us', $str, $matches) !== false) {
            return implode('', array_slice($matches[0], $start, $length));
        }
        return substr($str, $start, $length);
    }

    /**
     * @param mixed $attributes
     */
    private function extractRestAttributesSummary($attributes): string
    {
        if (!is_array($attributes)) {
            return '';
        }
        $parts = [];
        foreach ($attributes as $attr) {
            if (is_array($attr) && !empty($attr['option']) && is_scalar($attr['option'])) {
                $parts[] = $this->cleanText((string) $attr['option']);
            }
        }
        return implode(', ', array_filter($parts));
    }

    private function cleanDescription(string $raw): string
    {
        $clean = $this->cleanText($raw);
        if (self::safeStrlen($clean) > self::MAX_DESCRIPTION_LENGTH) {
            return self::safeSubstr($clean, 0, self::MAX_DESCRIPTION_LENGTH);
        }
        return $clean;
    }

    private function cleanText(string $text): string
    {
        if ($text === '') {
            return '';
        }
        $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $stripped = strip_tags($decoded);
        $normalized = preg_replace('/\s+/u', ' ', $stripped) ?? $stripped;
        return trim($normalized);
    }
}

if (!class_exists('Eidos_WC_Mapper', false)) {
    class_alias(Mapper::class, 'Eidos_WC_Mapper');
}
