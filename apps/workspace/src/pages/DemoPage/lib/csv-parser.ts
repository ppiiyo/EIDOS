export interface ParsedCatalogItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  price?: number;
  sku?: string;
  brand?: string;
  tags?: string[];
  inStock?: boolean;
  [key: string]: unknown;
}

export interface ParseResult {
  items: ParsedCatalogItem[];
  errors: string[];
  warnings: string[];
}

/**
 * Разбирает одну строку CSV с учётом кавычек и экранирования ("").
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Разбирает CSV-текст в массив товаров CatalogItem.
 * Обязательные колонки: id, title. Рекомендуемые: description, price, category, sku, brand, tags.
 */
export function parseCsv(text: string): ParseResult {
  const items: ParsedCatalogItem[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    errors.push('CSV-файл должен содержать заголовок и минимум одну строку данных.');
    return { items, errors, warnings };
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase().trim());

  const idIdx = headers.indexOf('id');
  const titleIdx = headers.indexOf('title');

  if (idIdx === -1 || titleIdx === -1) {
    const missing = [idIdx === -1 ? '"id"' : '', titleIdx === -1 ? '"title"' : '']
      .filter(Boolean)
      .join(' и ');
    errors.push(`Строка 1 (заголовок): отсутствуют обязательные колонки ${missing}.`);
    return { items, errors, warnings };
  }

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const rowNumber = lineIdx + 1;
    const values = parseCsvLine(lines[lineIdx]);

    const id = (values[idIdx] ?? '').trim();
    const title = (values[titleIdx] ?? '').trim();

    if (!id || !title) {
      const missingField = !id && !title ? '"id" и "title"' : !id ? '"id"' : '"title"';
      warnings.push(`Строка ${rowNumber}: пропущена (пустое обязательное поле ${missingField}).`);
      continue;
    }

    const item: ParsedCatalogItem = { id, title };

    headers.forEach((header, colIdx) => {
      if (colIdx === idIdx || colIdx === titleIdx) return;
      const rawVal = (values[colIdx] ?? '').trim();
      if (!rawVal) return;

      if (header === 'price') {
        const cleaned = rawVal.replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        if (Number.isNaN(num) || num < 0) {
          warnings.push(`Строка ${rowNumber}: некорректное поле "price" ("${rawVal}"), поле пропущено.`);
        } else {
          item.price = num;
        }
      } else if (header === 'tags') {
        item.tags = rawVal
          .split(/[;|]/)
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (header === 'instock' || header === 'in_stock') {
        item.inStock = ['true', '1', 'yes', 'да'].includes(rawVal.toLowerCase());
      } else if (header === 'category') {
        item.category = rawVal;
      } else if (header === 'description') {
        item.description = rawVal;
      } else if (header === 'sku') {
        item.sku = rawVal;
      } else if (header === 'brand') {
        item.brand = rawVal;
      } else {
        item[rawHeaders[colIdx].trim()] = rawVal;
      }
    });

    items.push(item);
  }

  if (items.length === 0 && errors.length === 0) {
    if (warnings.length > 0) {
      errors.push(...warnings);
    } else {
      errors.push('Не удалось извлечь ни одного валидного товара из CSV.');
    }
  }

  return { items, errors, warnings };
}

/**
 * Разбирает JSON-текст (массив товаров или объект { items: [...] }).
 */
export function parseJson(text: string): ParseResult {
  const items: ParsedCatalogItem[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    errors.push(`Ошибка синтаксиса JSON: ${err instanceof Error ? err.message : String(err)}`);
    return { items, errors, warnings };
  }

  const rawList: unknown[] | null = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { items?: unknown[] }).items)
      ? (parsed as { items: unknown[] }).items
      : null;

  if (!rawList) {
    errors.push('JSON должен быть массивом объектов [...] или объектом вида { "items": [...] }.');
    return { items, errors, warnings };
  }

  rawList.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      warnings.push(`Элемент #${idx + 1}: не является объектом, пропущен.`);
      return;
    }

    const record = entry as Record<string, unknown>;
    const id = record.id !== undefined && record.id !== null ? String(record.id).trim() : '';
    const title =
      record.title !== undefined && record.title !== null ? String(record.title).trim() : '';

    if (!id || !title) {
      warnings.push(`Элемент #${idx + 1}: отсутствует обязательное поле "id" или "title", пропущен.`);
      return;
    }

    const item: ParsedCatalogItem = {
      ...record,
      id,
      title,
    };

    if (record.description !== undefined) {
      item.description = String(record.description);
    }
    if (record.category !== undefined) {
      item.category = String(record.category);
    }
    if (record.price !== undefined) {
      const priceNum =
        typeof record.price === 'number'
          ? record.price
          : parseFloat(String(record.price).replace(/[^\d.-]/g, ''));
      if (!Number.isNaN(priceNum) && priceNum >= 0) {
        item.price = priceNum;
      } else {
        warnings.push(`Элемент #${idx + 1} (${id}): некорректная цена, поле пропущено.`);
        delete item.price;
      }
    }
    if (Array.isArray(record.tags)) {
      item.tags = record.tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof record.tags === 'string') {
      item.tags = record.tags
        .split(/[;|,]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }

    items.push(item);
  });

  if (items.length === 0 && errors.length === 0) {
    errors.push('Не найдено валидных товаров с полями "id" и "title".');
  }

  return { items, errors, warnings };
}

/**
 * Автоматически определяет формат файла (.csv или .json) и парсит его.
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  const text = await file.text();

  if (fileName.endsWith('.csv')) {
    return parseCsv(text);
  }
  if (fileName.endsWith('.json')) {
    return parseJson(text);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJson(text);
  }

  return parseCsv(text);
}
