import { ParsedCatalogItem, CsvParseResult } from './csv-parser';

export const SAMPLE_YML_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2026-11-01 12:00">
  <shop>
    <name>TechnoStore YML Demo</name>
    <company>OOO TechnoStore</company>
    <categories>
      <category id="10">Аудио и наушники</category>
      <category id="20">Ноутбуки и ультрабуки</category>
      <category id="30">Кофемашины и техника для кухни</category>
      <category id="40">Спорт и бег</category>
      <category id="50">Периферия и мониторы</category>
    </categories>
    <offers>
      <offer id="yml-101" available="true">
        <name>Беспроводные наушники Sennheiser Momentum 4 Wireless ANC</name>
        <vendor>Sennheiser</vendor>
        <vendorCode>SNH-M4-BLK</vendorCode>
        <price>27990</price>
        <currencyId>RUR</currencyId>
        <categoryId>10</categoryId>
        <description>Аудиофильские Bluetooth наушники с адаптивным шумоподавлением ANC, до 60 часов автономной работы, поддержка aptX Adaptive для музыки и бега.</description>
        <param name="Назначение">для бега, путешествий, музыки, работы</param>
      </offer>
      <offer id="yml-102" available="true">
        <name>Ультрабук ASUS Zenbook 14 OLED Ryzen 7 32GB/1TB</name>
        <vendor>ASUS</vendor>
        <vendorCode>UX3405-OLED</vendorCode>
        <price>114990</price>
        <currencyId>RUR</currencyId>
        <categoryId>20</categoryId>
        <description>Легкий металлический ноутбук 1.2 кг с экраном 2.8K OLED 120 Гц для программирования, разработки, работы в офисе и командировок.</description>
        <param name="Сценарий">программирование, разработка, офис</param>
      </offer>
      <offer id="yml-103" available="true">
        <name>Рожковая кофемашина Bork C804 Barista Pro</name>
        <vendor>Bork</vendor>
        <vendorCode>BRK-C804</vendorCode>
        <price>89900</price>
        <currencyId>RUR</currencyId>
        <categoryId>30</categoryId>
        <description>Профессиональная станция со встроенной жерновой кофемолкой и паровым капучинатором для утреннего эспрессо и латте.</description>
        <param name="Напитки">эспрессо, капучино, латте</param>
      </offer>
      <offer id="yml-104" available="true">
        <name>Марафонские кроссовки ASICS Metaspeed Sky Paris Carbon</name>
        <vendor>ASICS</vendor>
        <vendorCode>ASC-META-PARIS</vendorCode>
        <price>21490</price>
        <currencyId>RUR</currencyId>
        <categoryId>40</categoryId>
        <description>Сверхлегкие беговые кроссовки с карбоновой пластиной FF Turbo Plus для скоростного бега, марафона и тренировок на асфальте.</description>
        <param name="Вид спорта">бег, марафон, легкая атлетика</param>
      </offer>
      <offer id="yml-105" available="true">
        <name>Беспроводная игровая мышь Logitech G Pro X Superlight 2</name>
        <vendor>Logitech</vendor>
        <vendorCode>LOG-GPX2-WHT</vendorCode>
        <price>14990</price>
        <currencyId>RUR</currencyId>
        <categoryId>50</categoryId>
        <description>Киберспортивная мышь весом 60 г с оптическим сенсором HERO 2 32000 DPI, гибридными переключателями Lightforce и частотой 4000 Гц.</description>
        <param name="Сценарий">киберспорт, гейминг, игры</param>
      </offer>
      <offer id="yml-106" available="true">
        <name>Спортивные наушники Shokz OpenRun Pro Bone Conduction</name>
        <vendor>Shokz</vendor>
        <vendorCode>SHK-OPENRUN</vendorCode>
        <price>12990</price>
        <currencyId>RUR</currencyId>
        <categoryId>10</categoryId>
        <description>Недорогие спортивные наушники с костной проводимостью звука, защитой от пота IP55 и надежной дужкой специально для бега и велоспорта.</description>
        <param name="Назначение">бег, спорт, марафон, фитнес</param>
      </offer>
    </offers>
  </shop>
</yml_catalog>`;

function stripXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagValue(block: string, tagNames: string[]): string {
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = regex.exec(block);
    if (match && match[1]) {
      const cleaned = stripXmlEntities(match[1]);
      if (cleaned) return cleaned;
    }
  }
  return '';
}

/**
 * Parses Yandex.Market YML (<yml_catalog> / <offer>) and 1C-Bitrix CommerceML (<Товар>)
 * XML feeds into standard EIDOS ParsedCatalogItem objects.
 */
export function parseYmlXmlContent(xmlContent: string): CsvParseResult {
  const items: ParsedCatalogItem[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const text = (xmlContent || '').trim();
  if (!text) {
    return { items: [], errors: ['Пустой YML/XML фид.'], warnings: [], totalRows: 0 };
  }

  // 1. Extract category dictionary (<category id="10">Аудио</category> or <Группа>)
  const categoryMap = new Map<string, string>();
  const categoryRegex = /<category\s+[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/category>/gi;
  let catMatch: RegExpExecArray | null;
  while ((catMatch = categoryRegex.exec(text)) !== null) {
    const id = catMatch[1].trim();
    const name = stripXmlEntities(catMatch[2]);
    if (id && name) categoryMap.set(id, name);
  }

  // 2. Match YML <offer ...>...</offer> blocks or CommerceML <Товар>...</Товар> blocks
  const offerBlocks: Array<{ idAttr: string; body: string }> = [];
  const ymlOfferRegex = /<offer\b([^>]*)>([\s\S]*?)<\/offer>/gi;
  let m: RegExpExecArray | null;
  while ((m = ymlOfferRegex.exec(text)) !== null) {
    const attrs = m[1] || '';
    const idMatch = /id=["']([^"']+)["']/i.exec(attrs);
    offerBlocks.push({
      idAttr: idMatch ? idMatch[1].trim() : `yml-${offerBlocks.length + 1}`,
      body: m[2] || '',
    });
  }

  if (offerBlocks.length === 0) {
    const bitrixProductRegex = /<(?:Товар|item)(\s[^>]*)?>([\s\S]*?)<\/(?:Товар|item)>/gi;
    while ((m = bitrixProductRegex.exec(text)) !== null) {
      const body = m[2] || '';
      const idVal = extractTagValue(body, ['Ид', 'id', 'g:id']) || `xml-${offerBlocks.length + 1}`;
      offerBlocks.push({ idAttr: idVal, body });
    }
  }

  if (offerBlocks.length === 0) {
    return {
      items: [],
      errors: [
        'В XML/YML файле не найдены теги <offer> (Яндекс.Маркет) или <Товар> (1С-Битрикс CommerceML).',
      ],
      warnings: [],
      totalRows: 0,
    };
  }

  offerBlocks.forEach((offer, idx) => {
    const name = extractTagValue(offer.body, ['name', 'Наименование', 'title', 'g:title']);
    const typePrefix = extractTagValue(offer.body, ['typePrefix']);
    const vendor = extractTagValue(offer.body, ['vendor', 'Бренд', 'brand', 'g:brand']);
    const model = extractTagValue(offer.body, ['model']);

    const fullTitle =
      name ||
      [typePrefix, vendor, model].filter(Boolean).join(' ').trim();

    if (!fullTitle) {
      warnings.push(`Позиция #${idx + 1} (id=${offer.idAttr}): пропущена, так как отсутствует <name> или <model>.`);
      return;
    }

    const catId = extractTagValue(offer.body, ['categoryId', ' ИдГруппы']);
    const catName =
      (catId && categoryMap.get(catId)) ||
      extractTagValue(offer.body, ['category', 'Категория', 'g:product_type']) ||
      typePrefix ||
      'Каталог YML';

    const rawPrice = extractTagValue(offer.body, ['price', 'ЦенаЗаЕдиницу', 'g:price']);
    const numericPrice = rawPrice
      ? Number(rawPrice.replace(/[^\d.,]/g, '').replace(',', '.'))
      : undefined;

    const description = extractTagValue(offer.body, ['description', 'Описание', 'g:description']);
    const sku = extractTagValue(offer.body, ['vendorCode', 'Артикул', 'sku']);

    // Extract <param name="...">...</param> values into tags
    const paramValues: string[] = [];
    const paramRegex = /<param\b[^>]*>([\s\S]*?)<\/param>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = paramRegex.exec(offer.body)) !== null) {
      const val = stripXmlEntities(pm[1]);
      if (val) paramValues.push(...val.split(/[,;]+/).map((s) => s.trim()).filter(Boolean));
    }

    const tags = Array.from(
      new Set([
        catName.toLowerCase(),
        ...(vendor ? [vendor.toLowerCase()] : []),
        ...paramValues.map((p) => p.toLowerCase()),
      ])
    ).slice(0, 12);

    items.push({
      id: offer.idAttr || `yml-${idx + 1}`,
      title: fullTitle,
      category: catName,
      price: numericPrice !== undefined && !Number.isNaN(numericPrice) ? numericPrice : undefined,
      description: description || `${fullTitle} (${catName})`,
      sku: sku || undefined,
      brand: vendor || undefined,
      tags,
    });
  });

  return {
    items,
    errors,
    warnings,
    totalRows: offerBlocks.length,
  };
}
