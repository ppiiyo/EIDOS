export interface ParsedYmlItem {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  inStock: boolean;
  brand?: string;
  sku?: string;
  url?: string;
  imageUrl?: string | null;
  tags: string[];
}

function cleanXmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAttrValue(attrs: string, attrName: string): string | null {
  const lower = attrs.toLowerCase();
  const needle = attrName.toLowerCase();
  let pos = 0;
  while (pos < lower.length) {
    const idx = lower.indexOf(needle, pos);
    if (idx === -1) return null;
    const before = idx > 0 ? lower.charAt(idx - 1) : ' ';
    if (before !== ' ' && before !== '\t' && before !== '\n' && before !== '\r') {
      pos = idx + needle.length;
      continue;
    }
    let eqPos = idx + needle.length;
    while (eqPos < lower.length && (lower.charAt(eqPos) === ' ' || lower.charAt(eqPos) === '\t')) {
      eqPos++;
    }
    if (lower.charAt(eqPos) !== '=') {
      pos = eqPos;
      continue;
    }
    let quotePos = eqPos + 1;
    while (
      quotePos < lower.length &&
      (lower.charAt(quotePos) === ' ' || lower.charAt(quotePos) === '\t')
    ) {
      quotePos++;
    }
    const quoteChar = attrs.charAt(quotePos);
    if (quoteChar !== '"' && quoteChar !== "'") {
      pos = quotePos;
      continue;
    }
    const endQuote = attrs.indexOf(quoteChar, quotePos + 1);
    if (endQuote === -1) return null;
    return cleanXmlText(attrs.slice(quotePos + 1, endQuote));
  }
  return null;
}

function extractTag(block: string, tags: string[]): string {
  for (const tag of tags) {
    const openNeedle = `<${tag}`;
    const closeNeedle = `</${tag}>`;
    let pos = 0;
    while (pos < block.length) {
      const idx = block.indexOf(openNeedle, pos);
      if (idx === -1) break;
      const afterTagChar = block.charAt(idx + openNeedle.length);
      if (
        afterTagChar !== '>' &&
        afterTagChar !== ' ' &&
        afterTagChar !== '\t' &&
        afterTagChar !== '\n' &&
        afterTagChar !== '\r'
      ) {
        pos = idx + openNeedle.length;
        continue;
      }
      const tagEnd = block.indexOf('>', idx + openNeedle.length);
      if (tagEnd === -1) break;
      if (block.charAt(tagEnd - 1) === '/') {
        pos = tagEnd + 1;
        continue;
      }
      const closeIdx = block.indexOf(closeNeedle, tagEnd + 1);
      if (closeIdx === -1) break;
      const inner = cleanXmlText(block.slice(tagEnd + 1, closeIdx));
      if (inner) return inner;
      pos = closeIdx + closeNeedle.length;
    }
  }
  return '';
}

function extractOfferParams(block: string): Array<{ name: string; value: string }> {
  const params: Array<{ name: string; value: string }> = [];
  let pos = 0;
  while (pos < block.length && params.length < 32) {
    const idx = block.indexOf('<param', pos);
    if (idx === -1) break;
    const afterChar = block.charAt(idx + 6);
    if (
      afterChar !== '>' &&
      afterChar !== ' ' &&
      afterChar !== '\t' &&
      afterChar !== '\n' &&
      afterChar !== '\r'
    ) {
      pos = idx + 6;
      continue;
    }
    const tagEnd = block.indexOf('>', idx + 6);
    if (tagEnd === -1) break;
    if (block.charAt(tagEnd - 1) === '/') {
      pos = tagEnd + 1;
      continue;
    }
    const closeIdx = block.indexOf('</param>', tagEnd + 1);
    if (closeIdx === -1) break;
    const attrs = block.slice(idx + 6, tagEnd);
    const paramName = extractAttrValue(attrs, 'name') || '';
    const paramVal = cleanXmlText(block.slice(tagEnd + 1, closeIdx));
    if (paramVal) {
      params.push({ name: paramName, value: paramVal });
    }
    pos = closeIdx + 8;
  }
  return params;
}

function parsePriceValue(raw: string): number {
  if (!raw) return 0;
  const normalized = raw.replace(/\s+/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const val = parseFloat(normalized);
  return Number.isFinite(val) && val >= 0 ? val : 0;
}

export function parseYmlOrCommerceMl(xmlText: string, maxItems = 50_000): ParsedYmlItem[] {
  // Reject XML Entity declarations (XXE / Billion Laughs)
  if (/<!ENTITY\b/i.test(xmlText) || /<!DOCTYPE[^>]*\[/i.test(xmlText)) {
    throw new Error(
      'XML_ENTITY_FORBIDDEN: External or internal XML entities (DOCTYPE/ENTITY) are forbidden'
    );
  }

  const cap = Math.min(Math.max(maxItems, 1), 100_000);
  const categoryMap = new Map<string, string>();

  // Linear non-backtracking scan for <category id="...">...</category>
  let catPos = 0;
  while (catPos < xmlText.length) {
    const cStart = xmlText.indexOf('<category', catPos);
    if (cStart === -1) break;
    const nextChar = xmlText.charAt(cStart + 9);
    if (
      nextChar !== '>' &&
      nextChar !== ' ' &&
      nextChar !== '\t' &&
      nextChar !== '\n' &&
      nextChar !== '\r'
    ) {
      catPos = cStart + 9;
      continue;
    }
    const cOpenEnd = xmlText.indexOf('>', cStart + 9);
    if (cOpenEnd === -1) break;
    if (xmlText.charAt(cOpenEnd - 1) === '/') {
      catPos = cOpenEnd + 1;
      continue;
    }
    const cClose = xmlText.indexOf('</category>', cOpenEnd + 1);
    if (cClose === -1) break;
    const cAttrs = xmlText.slice(cStart + 9, cOpenEnd);
    const catId = extractAttrValue(cAttrs, 'id');
    const catName = cleanXmlText(xmlText.slice(cOpenEnd + 1, cClose));
    if (catId && catName) {
      categoryMap.set(catId, catName);
    }
    catPos = cClose + 11;
  }

  const items: ParsedYmlItem[] = [];
  let idx = 0;

  // Linear non-backtracking scan for <offer ...>...</offer> to support 50k+ offers without regex OOM
  let searchPos = 0;
  while (items.length < cap && searchPos < xmlText.length) {
    const offerStart = xmlText.indexOf('<offer', searchPos);
    if (offerStart === -1) break;
    const nextChar = xmlText.charAt(offerStart + 6);
    if (
      nextChar !== '>' &&
      nextChar !== ' ' &&
      nextChar !== '\t' &&
      nextChar !== '\n' &&
      nextChar !== '\r'
    ) {
      searchPos = offerStart + 6;
      continue;
    }
    const openEnd = xmlText.indexOf('>', offerStart + 6);
    if (openEnd === -1) break;
    const offerClose = xmlText.indexOf('</offer>', openEnd + 1);
    if (offerClose === -1) break;

    const attrs = xmlText.slice(offerStart + 6, openEnd);
    const bodyXml = xmlText.slice(openEnd + 1, offerClose);
    searchPos = offerClose + 8;

    idx++;
    const idAttr = extractAttrValue(attrs, 'id');
    const availableAttr = extractAttrValue(attrs, 'available');
    const inStock = availableAttr ? availableAttr.toLowerCase() !== 'false' : true;

    const id = idAttr || extractTag(bodyXml, ['id', 'vendorCode']) || `yml-${idx}`;
    const name = extractTag(bodyXml, ['name', 'model', 'title']);
    const vendor = extractTag(bodyXml, ['vendor', 'brand']);
    const vendorCode = extractTag(bodyXml, ['vendorCode', 'sku']);
    if (!name && !vendor) continue;

    const title =
      name && vendor && !name.toLowerCase().includes(vendor.toLowerCase())
        ? `${vendor} ${name}`
        : name || vendor;
    const catId = extractTag(bodyXml, ['categoryId']);
    const category =
      (catId && categoryMap.get(catId)) || extractTag(bodyXml, ['category']) || 'Каталог YML';
    const price = parsePriceValue(extractTag(bodyXml, ['price']));
    const offerParams = extractOfferParams(bodyXml);
    const paramSummary = offerParams
      .map((p) => (p.name ? `${p.name}: ${p.value}` : p.value))
      .join(', ');
    const baseDescription = extractTag(bodyXml, ['description', 'sales_notes']) || title;
    const description = paramSummary ? `${baseDescription}. ${paramSummary}` : baseDescription;
    const url = extractTag(bodyXml, ['url']) || undefined;
    const picture = extractTag(bodyXml, ['picture', 'image']) || null;
    const tags = [
      category,
      vendor,
      vendorCode,
      ...offerParams.map((p) => p.value),
    ].filter(Boolean);

    items.push({
      id,
      title,
      description,
      category,
      price,
      inStock,
      brand: vendor || undefined,
      sku: vendorCode || undefined,
      url,
      imageUrl: picture,
      tags,
    });
  }

  if (items.length === 0) {
    // 1C-Bitrix CommerceML 2.x support (<Товар> + <Предложение> / <Цены><Цена><ЦенаЗаЕдиницу>)
    const cmlGroups = new Map<string, string>();
    let grpPos = 0;
    while (grpPos < xmlText.length) {
      const gStart = xmlText.indexOf('<Группа', grpPos);
      if (gStart === -1) break;
      const gOpenEnd = xmlText.indexOf('>', gStart + 7);
      if (gOpenEnd === -1) break;
      const gClose = xmlText.indexOf('</Группа>', gOpenEnd + 1);
      if (gClose === -1) break;
      const gBody = xmlText.slice(gOpenEnd + 1, gClose);
      const gId = extractTag(gBody, ['Ид']);
      const gName = extractTag(gBody, ['Наименование']);
      if (gId && gName) {
        cmlGroups.set(gId, gName);
      }
      grpPos = gClose + 9;
    }

    // Parse <Предложение> blocks for prices and stock quantities
    const offerPrices = new Map<string, { price: number; inStock: boolean }>();
    let predPos = 0;
    while (predPos < xmlText.length) {
      const pStart = xmlText.indexOf('<Предложение', predPos);
      if (pStart === -1) break;
      const pOpenEnd = xmlText.indexOf('>', pStart + 12);
      if (pOpenEnd === -1) break;
      const pClose = xmlText.indexOf('</Предложение>', pOpenEnd + 1);
      if (pClose === -1) break;
      const pBody = xmlText.slice(pOpenEnd + 1, pClose);
      predPos = pClose + 14;

      const rawId = extractTag(pBody, ['Ид']);
      const priceVal = parsePriceValue(
        extractTag(pBody, ['ЦенаЗаЕдиницу', 'Цена'])
      );
      const qtyRaw = extractTag(pBody, ['Количество']);
      const qty = qtyRaw !== '' ? parseFloat(qtyRaw.replace(',', '.')) : 1;
      const inStock = Number.isNaN(qty) ? true : qty > 0;

      if (rawId) {
        offerPrices.set(rawId, { price: priceVal, inStock });
        const baseId = rawId.split('#')[0];
        if (baseId && !offerPrices.has(baseId)) {
          offerPrices.set(baseId, { price: priceVal, inStock });
        }
      }
    }

    let tovPos = 0;
    while (items.length < cap && tovPos < xmlText.length) {
      const tStart = xmlText.indexOf('<Товар', tovPos);
      if (tStart === -1) break;
      const nextChar = xmlText.charAt(tStart + 6);
      if (nextChar !== '>' && nextChar !== ' ' && nextChar !== '\t' && nextChar !== '\n' && nextChar !== '\r') {
        tovPos = tStart + 6;
        continue;
      }
      const tOpenEnd = xmlText.indexOf('>', tStart + 6);
      if (tOpenEnd === -1) break;
      const tClose = xmlText.indexOf('</Товар>', tOpenEnd + 1);
      if (tClose === -1) break;

      const bx = xmlText.slice(tOpenEnd + 1, tClose);
      tovPos = tClose + 8;

      idx++;
      const id = extractTag(bx, ['Ид', 'Артикул']) || `bx-${idx}`;
      const baseId = id.split('#')[0];
      const title = extractTag(bx, ['Наименование', 'ПолноеНаименование']);
      if (!title) continue;
      const description = extractTag(bx, ['Описание']) || title;
      const sku = extractTag(bx, ['Артикул']);
      const brand = extractTag(bx, ['Изготовитель', 'Бренд', 'Производитель']);

      // Resolve category from <Группы><Ид>
      let category = 'Bitrix CommerceML';
      const groupsBlockStart = bx.indexOf('<Группы>');
      const groupsBlockEnd = groupsBlockStart !== -1 ? bx.indexOf('</Группы>', groupsBlockStart) : -1;
      if (groupsBlockStart !== -1 && groupsBlockEnd !== -1) {
        const grpId = extractTag(bx.slice(groupsBlockStart, groupsBlockEnd), ['Ид']);
        if (grpId && cmlGroups.has(grpId)) {
          category = cmlGroups.get(grpId)!;
        }
      }

      // Resolve price from <Предложение> or inline <Цены><Цена><ЦенаЗаЕдиницу>
      const matchedOffer = offerPrices.get(id) || offerPrices.get(baseId);
      const inlinePrice = parsePriceValue(extractTag(bx, ['ЦенаЗаЕдиницу', 'Цена']));
      const price = matchedOffer && matchedOffer.price > 0 ? matchedOffer.price : inlinePrice;
      const inStock = matchedOffer ? matchedOffer.inStock : true;

      items.push({
        id,
        title,
        description,
        category,
        price,
        inStock,
        brand: brand || undefined,
        sku: sku || undefined,
        tags: ['CommerceML', category, brand, sku].filter(Boolean),
      });
    }
  }

  return items;
}
