<?php
/**
 * Field Mapper transforming WC_Product objects and WooCommerce REST API payloads
 * into canonical EIDOS Connector v1.0 schema.
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
 */
class Mapper
{
    public const MAX_DESCRIPTION_LENGTH = 5000;

    /**
     * 6. Бизнес-логика: преобразование товара WooCommerce (объекта WC_Product или массива из REST API)
     * в канонический формат EIDOS Connector v1.0.
     *
     * Для объектов WC_Product использует штатные функции WordPress/WooCommerce:
     * - $product->get_id(), $product->get_name(), wp_strip_all_tags($product->get_description())
     * - wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'names'])
     * - (float)$product->get_price(), $product->is_in_stock()
     * - wp_get_post_terms($product->get_id(), 'product_tag', ['fields' => 'names'])
     * - get_permalink($product->get_id()), wp_get_attachment_url($product->get_image_id())
     *
     * @param mixed                     $product       WC_Product instance or REST API product/variation array
     * @param array<string, mixed>|null $parentContext Optional parent product data when mapping a variation
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl: ?string}
     */
    public function mapFields(mixed $product, ?array $parentContext = null): array
    {
        if (is_object($product) && method_exists($product, 'get_id')) {
            return $this->mapFromWcProductObject($product, $parentContext);
        }

        if (is_array($product)) {
            return $this->mapFromRestArray($product, $parentContext);
        }

        throw new InvalidArgumentException('Product must be a WC_Product instance or WooCommerce REST API array.');
    }

    /**
     * Преобразование из нативного объекта WC_Product / WC_Product_Variation.
     *
     * @param object                    $product
     * @param array<string, mixed>|null $parentContext
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl: ?string}
     */
    private function mapFromWcProductObject(object $product, ?array $parentContext = null): array
    {
        $productId = (int) $product->get_id();
        if ($productId <= 0) {
            throw new InvalidArgumentException('WC_Product ID must be a positive integer.');
        }

        // Если это вариация (WC_Product_Variation), наследуем категории/теги от родительского товара
        $parentId = method_exists($product, 'get_parent_id') ? (int) $product->get_parent_id() : 0;
        $termTargetId = $parentId > 0 ? $parentId : $productId;

        $rawTitle = method_exists($product, 'get_name') ? (string) $product->get_name() : '';
        if ($rawTitle === '' && $parentContext !== null && !empty($parentContext['title'])) {
            $rawTitle = (string) $parentContext['title'];
        }
        $title = $this->cleanText($rawTitle);
        if ($title === '') {
            throw new InvalidArgumentException(sprintf('Product %d title must not be empty.', $productId));
        }

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

        // Категории через wp_get_post_terms($id, 'product_cat', ['fields' => 'names'])
        $categoryNames = [];
        if (function_exists('wp_get_post_terms')) {
            $terms = wp_get_post_terms($termTargetId, 'product_cat', ['fields' => 'names']);
            if (is_array($terms)) {
                foreach ($terms as $termName) {
                    if (is_string($termName) && trim($termName) !== '') {
                        $categoryNames[] = $this->cleanText($termName);
                    }
                }
            }
        }
        $category = !empty($categoryNames)
            ? implode(', ', $categoryNames)
            : ($parentContext['category'] ?? 'Uncategorized');

        // Цена и наличие
        $rawPrice = method_exists($product, 'get_price') ? $product->get_price() : 0;
        $price = max(0.0, round((float) $rawPrice, 2));

        $inStock = method_exists($product, 'is_in_stock')
            ? (bool) $product->is_in_stock()
            : true;

        // Теги через wp_get_post_terms($id, 'product_tag', ['fields' => 'names'])
        $tags = [];
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

        // Для вариаций добавляем значения атрибутов (размер, цвет и т.д.) в теги для улучшения семантического поиска
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
        $tags = array_values(array_unique(array_filter($tags, static fn(string $t): bool => $t !== '')));

        // Постоянная ссылка и изображение
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

        return [
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
    }

    /**
     * Преобразование из массива ответа WooCommerce REST API (/wp-json/wc/v3/products и /variations).
     *
     * @param array<string, mixed>      $item
     * @param array<string, mixed>|null $parentContext
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl: ?string}
     */
    private function mapFromRestArray(array $item, ?array $parentContext = null): array
    {
        $rawId = $item['id'] ?? '';
        $id = trim((string) $rawId);
        if ($id === '' || $id === '0') {
            throw new InvalidArgumentException('WooCommerce REST item id must not be empty.');
        }

        // Формирование названия (для вариаций комбинируем имя родителя и атрибуты вариации, если name не задан)
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

        $title = $this->cleanText($rawName);
        if ($title === '') {
            throw new InvalidArgumentException(sprintf('Product %s title must not be empty.', $id));
        }

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

        // Категории из массива categories: [['id' => 1, 'name' => 'Shoes'], ...]
        $catNames = [];
        if (!empty($item['categories']) && is_array($item['categories'])) {
            foreach ($item['categories'] as $cat) {
                if (is_array($cat) && !empty($cat['name'])) {
                    $catNames[] = $this->cleanText((string) $cat['name']);
                } elseif (is_string($cat) && trim($cat) !== '') {
                    $catNames[] = $this->cleanText($cat);
                }
            }
        }
        $category = !empty($catNames)
            ? implode(', ', array_unique($catNames))
            : (string) ($item['category'] ?? ($parentContext['category'] ?? 'Uncategorized'));

        // Цена (price -> regular_price -> sale_price)
        $rawPrice = $item['price'] ?? ($item['regular_price'] ?? ($item['sale_price'] ?? 0));
        if ($rawPrice === '' && $parentContext !== null && isset($parentContext['price'])) {
            $rawPrice = $parentContext['price'];
        }
        $price = is_numeric($rawPrice) ? max(0.0, round((float) $rawPrice, 2)) : 0.0;

        // Статус наличия: stock_status === 'instock' или булево in_stock / inStock
        if (isset($item['stock_status'])) {
            $inStock = strtolower((string) $item['stock_status']) === 'instock';
        } elseif (isset($item['in_stock'])) {
            $inStock = (bool) $item['in_stock'];
        } elseif (isset($item['inStock'])) {
            $inStock = (bool) $item['inStock'];
        } else {
            $inStock = true;
        }

        // Теги из массива tags: [['id' => 1, 'name' => 'New'], ...] + атрибуты вариации
        $tags = [];
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
        $tags = array_values(array_unique(array_filter($tags, static fn(string $t): bool => $t !== '')));

        // URL карточки товара
        $url = (string) ($item['permalink'] ?? $item['url'] ?? ($parentContext['url'] ?? ''));

        // Изображение (image.src для вариации или images[0].src для родительского товара)
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

        return [
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
    }

    /**
     * Формирует тело элемента для батч-запроса POST /v1/catalog/upsert.
     *
     * @param array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string} $mapped
     * @return array<string, mixed>
     */
    public function toUpsertPayload(array $mapped): array
    {
        $payload = [
            'id' => $mapped['id'],
            'title' => $mapped['title'],
            'description' => $mapped['description'],
            'category' => $mapped['category'] !== '' ? $mapped['category'] : 'General',
            'price' => $mapped['price'],
            'inStock' => $mapped['inStock'],
            'tags' => $mapped['tags'],
            'url' => $mapped['url'],
        ];

        if (!empty($mapped['imageUrl'])) {
            $payload['imageUrl'] = $mapped['imageUrl'];
        }

        return $payload;
    }

    /**
     * @param mixed $attributes
     */
    private function extractRestAttributesSummary(mixed $attributes): string
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
        if (mb_strlen($clean, 'UTF-8') > self::MAX_DESCRIPTION_LENGTH) {
            return mb_substr($clean, 0, self::MAX_DESCRIPTION_LENGTH, 'UTF-8');
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
