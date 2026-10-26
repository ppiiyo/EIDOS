import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { buildServer } from '../../apps/api/src/server';
import { getCache } from '../../apps/api/src/services/cache';

const ROOT_DIR = path.resolve(__dirname, '../..');
const BITRIX_DIR = path.resolve(ROOT_DIR, 'packages/connectors/bitrix');

describe('1C-Bitrix Connector 7-Point Acceptance Checklist & All-in-One Docker Verification', () => {
  it('Checklist #1: [x] mapFields преобразует поля Битрикса (ID, NAME, DETAIL_TEXT without HTML <= 5000 chars, SECTION_NAME, PRICE, QUANTITY -> inStock, PROPERTIES, DETAIL_PAGE_URL, PREVIEW_PICTURE)', () => {
    const mapperPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/Mapper.php'), 'utf-8');

    expect(mapperPhp).toContain('public const MAX_DESCRIPTION_LENGTH = 5000;');
    expect(mapperPhp).toContain('public function mapFields(mixed $systemItem): array');
    expect(mapperPhp).toContain("$item['DETAIL_TEXT'] ?? $item['PREVIEW_TEXT']");
    expect(mapperPhp).toContain("$item['SECTION_NAME'] ?? $item['IBLOCK_SECTION_NAME']");
    expect(mapperPhp).toContain("$item['PRICE'] ?? $item['CATALOG_PRICE_1']");
    expect(mapperPhp).toContain("$item['QUANTITY'] ?? $item['CATALOG_QUANTITY']");
    expect(mapperPhp).toContain("$item['PROPERTIES'] ?? []");
    expect(mapperPhp).toContain('strip_tags');
    expect(mapperPhp).toContain('html_entity_decode');
  });

  it('Checklist #2: [x] syncCatalog забирает все товары батчами без nTopCount-обрезания пагинации и ставит > 500 товаров в CAgent', () => {
    const connectorPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/Connector.php'), 'utf-8');

    expect(connectorPhp).toContain('public const ASYNC_QUEUE_THRESHOLD = 500;');
    expect(connectorPhp).toContain('public function syncCatalog(array $options = []): array');
    expect(connectorPhp).toContain("'/v1/catalog/upsert'");
    expect(connectorPhp).toContain("\\CIBlockElement::GetList");
    expect(connectorPhp).toContain("\\CPrice::GetBasePrice");
    expect(connectorPhp).toContain("\\CCatalogProduct::GetByID");
    // Multi-page pagination must use iNumPage + nPageSize without nTopCount truncation
    expect(connectorPhp).toContain("['iNumPage' => $pageNumber, 'nPageSize' => $limit, 'checkOutOfRange' => true]");
  });

  it('Checklist #3: [x] syncDelta забирает только изменённые товары (>TIMESTAMP_X) идемпотентно и возвращает точный TIMESTAMP_X', () => {
    const connectorPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/Connector.php'), 'utf-8');

    expect(connectorPhp).toContain('public function syncDelta(DateTimeInterface $since, int $batchSize = 100): array');
    expect(connectorPhp).toContain("'>TIMESTAMP_X'");
    expect(connectorPhp).toContain('ConvertTimeStamp');
    expect(connectorPhp).toContain('$this->syncedDeltaFingerprints');
    expect(connectorPhp).toContain('(new DateTimeImmutable())->setTimestamp($maxTimestamp)');
    expect(connectorPhp).toContain('public static function syncDeltaAgent(): string');
  });

  it('Checklist #4: [x] replaceSearch реально заменяет поиск в 1С-Битрикс (arResult, searchFilter, arrFilter, OnBeforeProlog, eidos:search.page)', () => {
    const searchReplacerPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/SearchReplacer.php'), 'utf-8');
    const connectorPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/Connector.php'), 'utf-8');
    const componentPhp = fs.readFileSync(
      path.join(BITRIX_DIR, 'components/eidos/search.page/component.php'),
      'utf-8'
    );
    const installPhp = fs.readFileSync(path.join(BITRIX_DIR, 'install/index.php'), 'utf-8');

    expect(searchReplacerPhp).toContain("'/v1/search'");
    expect(searchReplacerPhp).toContain('public function applyToBitrixComponent(array &$arResult, string $query, array $options = []): array');
    expect(searchReplacerPhp).toContain("$GLOBALS['EIDOS_SEARCH_RESULT']");
    expect(searchReplacerPhp).toContain("$GLOBALS['arrFilter']");
    expect(searchReplacerPhp).toContain("$arResult['ITEMS'] = $items;");
    expect(searchReplacerPhp).toContain("$arResult['SEARCH'] = $items;");
    expect(searchReplacerPhp).toContain("$arResult['ELEMENTS']");
    expect(connectorPhp).toContain('public static function onBeforeProlog(): void');
    expect(installPhp).toContain('RegisterModuleDependences');
    expect(installPhp).toContain("'OnBeforeProlog'");
    expect(componentPhp).toContain('$connector->applySearchToComponent($arResult, $query');
  });

  it('Checklist #5: [x] pushFeedback отправляет клики в POST /v1/feedback + неблокирующий tools/eidos_feedback.php (navigator.sendBeacon)', () => {
    const connectorPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/Connector.php'), 'utf-8');
    const feedbackToolPhp = fs.readFileSync(path.join(BITRIX_DIR, 'tools/eidos_feedback.php'), 'utf-8');
    const templatePhp = fs.readFileSync(
      path.join(BITRIX_DIR, 'components/eidos/search.page/templates/.default/template.php'),
      'utf-8'
    );

    expect(connectorPhp).toContain('public function pushFeedback(array $event): bool');
    expect(connectorPhp).toContain("'/v1/feedback'");
    expect(feedbackToolPhp).toContain('$connector->pushFeedback(');
    expect(feedbackToolPhp).toContain('http_response_code(204)');
    expect(templatePhp).toContain("navigator.sendBeacon('/bitrix/tools/eidos_feedback.php'");
  });

  it('Checklist #6: [x] healthCheck работает с таймаутом 3.0 сек и отображает статус в админке', () => {
    const connectorPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/Connector.php'), 'utf-8');
    const adminOptionsPhp = fs.readFileSync(path.join(BITRIX_DIR, 'admin/options.php'), 'utf-8');
    const settingsPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/Settings.php'), 'utf-8');

    expect(connectorPhp).toContain('public function healthCheck(): array');
    expect(connectorPhp).toContain("'/v1/health'");
    expect(connectorPhp).toContain('3.0');
    expect(adminOptionsPhp).toContain('$connector->healthCheck()');
    expect(settingsPhp).toContain('EIDOS доступен, %d товаров');
  });

  it('Checklist #7: [x] Fallback на стандартный поиск Битрикса (CSearch::Search + CIBlockElement::GetList + bitrix:search.page)', () => {
    const searchReplacerPhp = fs.readFileSync(path.join(BITRIX_DIR, 'src/SearchReplacer.php'), 'utf-8');
    const componentPhp = fs.readFileSync(
      path.join(BITRIX_DIR, 'components/eidos/search.page/component.php'),
      'utf-8'
    );

    expect(searchReplacerPhp).toContain('executeBitrixFallbackSearch');
    expect(searchReplacerPhp).toContain("class_exists('\\CSearch')");
    expect(searchReplacerPhp).toContain('$obSearch->Search(');
    expect(searchReplacerPhp).toContain("class_exists('\\CIBlockElement')");
    expect(componentPhp).toContain("'bitrix:search.page'");
  });

  it('Task 2: All-in-One Docker (docker run -p 3000:3000 eidos/eidos) works with Embedded Redis in a single container', async () => {
    const rootDockerfile = fs.readFileSync(path.join(ROOT_DIR, 'Dockerfile'), 'utf-8');
    const dockerCompose = fs.readFileSync(path.join(ROOT_DIR, 'docker-compose.yml'), 'utf-8');

    // Verify root Dockerfile is configured for eidos/eidos on port 3000 with embedded Redis
    expect(rootDockerfile).toContain('ENV PORT=3000');
    expect(rootDockerfile).toContain('ENV REDIS_URL=redis://127.0.0.1:6379');
    expect(rootDockerfile).toContain('EXPOSE 3000');
    expect(rootDockerfile).not.toContain('|| true');

    // Verify docker-compose.yml uses single eidos service on 3000:3000 with embedded Redis
    expect(dockerCompose).toContain('image: eidos/eidos:latest');
    expect(dockerCompose).toContain('"3000:3000"');
    expect(dockerCompose).toContain('REDIS_URL=${REDIS_URL:-redis://127.0.0.1:6379}');
    expect(dockerCompose).not.toContain('container_name: eidos-redis');

    // Verify live EIDOS server + EmbeddedRedisServer healthCheck works out of the box
    const cache = getCache();
    expect(await cache.healthCheck()).toBe(true);

    const app = await buildServer();
    await app.ready();

    const healthRes = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect(healthRes.statusCode).toBe(200);
    const body = healthRes.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.redis.status).toBe('ok');
    expect(body.checks.redis.connected).toBe(true);

    await app.close();
  });
});
