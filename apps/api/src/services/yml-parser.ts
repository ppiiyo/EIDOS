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

function extractTag(block: string, tags: string[]): string {
  for (const tag of tags) {
    const rx = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = rx.exec(block);
    if (m && m[1]) {
      const clean = m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean) return clean;
    }
  }
  return '';
}

export function parseYmlOrCommerceMl(xmlText: string, maxItems = 50_000): ParsedYmlItem[] {
  const cap = Math.min(Math.max(maxItems, 1), 100_000);
  const categoryMap = new Map<string, string>();
  const catRegex = /<category\s+[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/category>/gi;
  let catMatch: RegExpExecArray | null;
  while ((catMatch = catRegex.exec(xmlText)) !== null) {
    categoryMap.set(catMatch[1].trim(), catMatch[2].replace(/<[^>]+>/g, '').trim());
  }

  const items: ParsedYmlItem[] = [];
  const offerRegex = /<offer(\s[^>]*)?>([\s\S]*?)<\/offer>/gi;
  let offerMatch: RegExpExecArray | null;
  let idx = 0;

  while ((offerMatch = offerRegex.exec(xmlText)) !== null && items.length < cap) {
    idx++;
    const attrs = offerMatch[1] || '';
    const bodyXml = offerMatch[2] || '';
    const idAttr = /id=["']([^"']+)["']/i.exec(attrs);
    const availableAttr = /available=["'](true|false)["']/i.exec(attrs);
    const inStock = availableAttr ? availableAttr[1].toLowerCase() !== 'false' : true;

    const id = (idAttr ? idAttr[1] : extractTag(bodyXml, ['id', 'vendorCode'])) || `yml-${idx}`;
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
    const priceRaw = parseFloat(extractTag(bodyXml, ['price']).replace(/[^\d.]/g, ''));
    const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0;
    const description = extractTag(bodyXml, ['description', 'sales_notes']) || title;
    const url = extractTag(bodyXml, ['url']) || undefined;
    const picture = extractTag(bodyXml, ['picture', 'image']) || null;
    const tags = [category, vendor, vendorCode].filter(Boolean);

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
    const bitrixRegex = /<Товар(\s[^>]*)?>([\s\S]*?)<\/Товар>/gi;
    let bm: RegExpExecArray | null;
    while ((bm = bitrixRegex.exec(xmlText)) !== null && items.length < cap) {
      idx++;
      const bx = bm[2] || '';
      const id = extractTag(bx, ['Ид', 'Артикул']) || `bx-${idx}`;
      const title = extractTag(bx, ['Наименование', 'ПолноеНаименование']);
      if (!title) continue;
      const description = extractTag(bx, ['Описание']) || title;
      const sku = extractTag(bx, ['Артикул']);
      items.push({
        id,
        title,
        description,
        category: 'Bitrix CommerceML',
        price: 0,
        inStock: true,
        sku: sku || undefined,
        tags: ['CommerceML', sku].filter(Boolean),
      });
    }
  }

  return items;
}
