<?php
/**
 * Шаблон компонента eidos:search.page (.default) с неблокирующей отправкой кликов через navigator.sendBeacon.
 *
 * @var array<string, mixed> $arResult
 * @var array<string, mixed> $arParams
 */
?>
<div class="eidos-search-page">
    <form action="" method="get" class="eidos-search-form" style="margin-bottom: 20px;">
        <input
            type="text"
            name="q"
            value="<?= $arResult['QUERY'] ?? '' ?>"
            size="40"
            placeholder="Поиск по каталогу..."
            class="eidos-search-input"
        />
        <button type="submit" class="eidos-search-submit">Найти</button>
    </form>

    <?php if (!empty($arResult['ITEMS'])): ?>
        <div class="eidos-search-results">
            <?php foreach ($arResult['ITEMS'] as $item): ?>
                <?php
                $itemId = htmlspecialchars((string) ($item['ID'] ?? ''), ENT_QUOTES, 'UTF-8');
                $itemUrl = htmlspecialchars((string) ($item['URL'] ?? $item['DETAIL_PAGE_URL'] ?? '#'), ENT_QUOTES, 'UTF-8');
                $itemName = htmlspecialchars((string) ($item['NAME'] ?? ''), ENT_QUOTES, 'UTF-8');
                $itemBody = htmlspecialchars((string) ($item['BODY_FORMATED'] ?? ''), ENT_QUOTES, 'UTF-8');
                $itemPrice = isset($item['PRICE']) && (float) $item['PRICE'] > 0 ? number_format((float) $item['PRICE'], 0, '.', ' ') : null;
                $itemExplanation = !empty($item['EXPLANATION']) ? htmlspecialchars((string) $item['EXPLANATION'], ENT_QUOTES, 'UTF-8') : null;
                ?>
                <div class="eidos-search-item" style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <div class="eidos-search-item-title">
                        <a
                            href="<?= $itemUrl ?>"
                            data-eidos-item-id="<?= $itemId ?>"
                            onclick="eidosTrackClick(<?= json_encode((string) ($item['ID'] ?? '')) ?>, <?= json_encode((string) ($arResult['QUERY'] ?? '')) ?>)"
                        >
                            <?= $itemName ?>
                        </a>
                        <?php if ($itemPrice !== null): ?>
                            <span class="eidos-search-item-price" style="margin-left: 10px; font-weight: bold;">
                                <?= $itemPrice ?> ₽
                            </span>
                        <?php endif; ?>
                    </div>
                    <?php if ($itemBody !== ''): ?>
                        <div class="eidos-search-item-description" style="color: #555; margin-top: 4px;">
                            <?= $itemBody ?>
                        </div>
                    <?php endif; ?>
                    <?php if ($itemExplanation !== null): ?>
                        <div class="eidos-search-item-explanation" style="font-size: 12px; color: #2e7d32; margin-top: 4px;">
                            <?= $itemExplanation ?>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        </div>
    <?php elseif (!empty($arResult['QUERY'])): ?>
        <p class="eidos-search-empty">По вашему запросу ничего не найдено.</p>
    <?php endif; ?>
</div>

<script>
function eidosTrackClick(itemId, query) {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/bitrix/tools/eidos_feedback.php', JSON.stringify({
            itemId: String(itemId),
            query: String(query || ''),
            eventType: 'click'
        }));
    }
}
</script>
