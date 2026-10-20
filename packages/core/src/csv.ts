/**
 * Production RFC 4180 compliant CSV / TSV parser and semantic concept importer.
 * Supports:
 * - Auto-detection of delimiters (comma, semicolon, tab, pipe)
 * - Escaped quotes, commas and multi-line fields within quotes
 * - UTF-8 Byte Order Mark (BOM) stripping
 * - Automatic header detection and flexible column mapping
 * - De-duplication, validation, and sanitization
 */

export interface ParsedCsvRow {
  rowIndex: number;
  raw: string[];
  mapped: {
    name: string;
    category?: string;
    notes?: string;
  };
  isValid: boolean;
  isDuplicate?: boolean;
  error?: string;
}

export interface CsvParseOptions {
  delimiter?: string;
  hasHeaders?: boolean;
  nameColumn?: string | number;
  categoryColumn?: string | number;
  notesColumn?: string | number;
  deduplicate?: boolean;
  trimWhitespace?: boolean;
}

export interface CsvParseResult {
  delimiter: string;
  hasHeaders: boolean;
  headers: string[];
  totalRows: number;
  validRows: ParsedCsvRow[];
  invalidRows: ParsedCsvRow[];
  duplicatesCount: number;
  concepts: Array<{
    name: string;
    category?: string;
    notes?: string;
  }>;
  warnings: string[];
}

/**
 * Strips UTF-8 Byte Order Mark (\uFEFF) if present at beginning of file.
 */
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Detects the most probable delimiter in CSV text based on count and consistency.
 */
export function detectDelimiter(text: string): string {
  const candidates = [',', ';', '\t', '|'];
  const sampleLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10);

  if (sampleLines.length === 0) return ',';

  let bestDelimiter = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    let consistentCount: number | null = null;
    let totalCount = 0;
    let isConsistent = true;

    for (const line of sampleLines) {
      // Count delimiters outside quoted strings
      let inQuote = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === delim && !inQuote) {
          count++;
        }
      }

      totalCount += count;
      if (consistentCount === null) {
        consistentCount = count;
      } else if (consistentCount !== count && count > 0) {
        isConsistent = false;
      }
    }

    if (totalCount > 0) {
      // Score higher if delimiter count is consistent across rows
      const score = totalCount * (isConsistent ? 2.5 : 1.0);
      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delim;
      }
    }
  }

  return bestDelimiter;
}

/**
 * Tokenizes and parses CSV text into a 2D array of strings according to RFC 4180.
 */
export function parseCsvToGrid(
  rawText: string,
  delimiter: string = ','
): string[][] {
  const text = stripBom(rawText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];
    const nextChar = i + 1 < len ? text[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    }

    // Not inside quotes
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    } else if (char === delimiter) {
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    } else if (char === '\r') {
      if (nextChar === '\n') {
        i++; // skip \r, \n handled next
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i++;
      continue;
    } else if (char === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i++;
      continue;
    } else {
      currentField += char;
      i++;
    }
  }

  // Push final field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Clean trailing empty lines
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === '')) {
    rows.pop();
  }

  return rows;
}

/**
 * Auto-detects if the first row is likely a header row.
 */
export function detectHasHeaders(firstRow: string[]): boolean {
  if (!firstRow || firstRow.length === 0) return false;

  const headerKeywords = [
    'concept',
    'name',
    'title',
    'term',
    'label',
    'keyword',
    'tag',
    'category',
    'cluster',
    'group',
    'domain',
    'notes',
    'description',
    'desc',
    'details',
    'definition',
    'концепт',
    'название',
    'термин',
    'категория',
    'описание',
    'заметки',
  ];

  const matched = firstRow.some((col) => {
    const clean = col.trim().toLowerCase();
    return headerKeywords.includes(clean);
  });

  return matched;
}

/**
 * Auto-maps column indices to semantic fields (name, category, notes).
 */
export function autoMapColumns(headers: string[]): {
  nameIndex: number;
  categoryIndex: number;
  notesIndex: number;
} {
  let nameIndex = 0;
  let categoryIndex = -1;
  let notesIndex = -1;

  const nameSynonyms = [
    'name',
    'concept',
    'title',
    'term',
    'label',
    'keyword',
    'item',
    'концепт',
    'название',
    'термин',
    'имя',
  ];
  const catSynonyms = [
    'category',
    'cluster',
    'group',
    'domain',
    'tag',
    'type',
    'категория',
    'кластер',
    'группа',
    'домен',
    'тег',
  ];
  const noteSynonyms = [
    'notes',
    'note',
    'description',
    'desc',
    'details',
    'definition',
    'summary',
    'context',
    'заметки',
    'описание',
    'детали',
  ];

  headers.forEach((header, idx) => {
    const clean = header.trim().toLowerCase();
    if (categoryIndex === -1 && catSynonyms.some((s) => clean.includes(s))) {
      categoryIndex = idx;
    } else if (notesIndex === -1 && noteSynonyms.some((s) => clean.includes(s))) {
      notesIndex = idx;
    } else if (nameSynonyms.some((s) => clean.includes(s))) {
      nameIndex = idx;
    }
  });

  // If category or notes accidentally matched nameIndex, resolve conflict
  if (categoryIndex === nameIndex) categoryIndex = -1;
  if (notesIndex === nameIndex) notesIndex = -1;

  // If no category was detected but we have 2 columns and 2nd isn't notes:
  if (categoryIndex === -1 && headers.length === 2 && notesIndex !== 1) {
    categoryIndex = 1;
  } else if (categoryIndex === -1 && headers.length >= 3 && notesIndex !== 1) {
    categoryIndex = 1;
    if (notesIndex === -1) notesIndex = 2;
  }

  return { nameIndex, categoryIndex, notesIndex };
}

/**
 * Parses and sanitizes semantic concepts from CSV text.
 */
export function parseSemanticConceptsCsv(
  csvText: string,
  options: CsvParseOptions = {}
): CsvParseResult {
  const warnings: string[] = [];
  const text = stripBom(csvText.trim());

  if (!text) {
    return {
      delimiter: ',',
      hasHeaders: false,
      headers: [],
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      duplicatesCount: 0,
      concepts: [],
      warnings: ['Файл или текст пуст.'],
    };
  }

  const delimiter = options.delimiter || detectDelimiter(text);
  const grid = parseCsvToGrid(text, delimiter);

  if (grid.length === 0) {
    return {
      delimiter,
      hasHeaders: false,
      headers: [],
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      duplicatesCount: 0,
      concepts: [],
      warnings: ['Не удалось распознать строки CSV.'],
    };
  }

  const hasHeaders =
    options.hasHeaders !== undefined
      ? options.hasHeaders
      : detectHasHeaders(grid[0]);

  const rawHeaders = hasHeaders
    ? grid[0].map((h, i) => h.trim() || `Колонка ${i + 1}`)
    : grid[0].map((_, i) => `Колонка ${i + 1}`);

  const dataRows = hasHeaders ? grid.slice(1) : grid;

  // Determine column indices
  const autoMapping = autoMapColumns(rawHeaders);

  const getColIndex = (
    colOption: string | number | undefined,
    fallback: number
  ): number => {
    if (typeof colOption === 'number') return colOption;
    if (typeof colOption === 'string') {
      const idx = rawHeaders.findIndex(
        (h) => h.toLowerCase() === colOption.toLowerCase()
      );
      if (idx !== -1) return idx;
    }
    return fallback;
  };

  const nameIdx = getColIndex(options.nameColumn, autoMapping.nameIndex);
  const catIdx = getColIndex(options.categoryColumn, autoMapping.categoryIndex);
  const notesIdx = getColIndex(options.notesColumn, autoMapping.notesIndex);

  const validRows: ParsedCsvRow[] = [];
  const invalidRows: ParsedCsvRow[] = [];
  const seenNames = new Set<string>();
  let duplicatesCount = 0;

  dataRows.forEach((row, index) => {
    const rowIndex = hasHeaders ? index + 2 : index + 1;
    const rawName = row[nameIdx] !== undefined ? row[nameIdx].trim() : '';
    const rawCategory =
      catIdx >= 0 && row[catIdx] !== undefined ? row[catIdx].trim() : undefined;
    const rawNotes =
      notesIdx >= 0 && row[notesIdx] !== undefined ? row[notesIdx].trim() : undefined;

    // Check validity
    if (!rawName) {
      invalidRows.push({
        rowIndex,
        raw: row,
        mapped: { name: '', category: rawCategory, notes: rawNotes },
        isValid: false,
        error: 'Отсутствует название концепта',
      });
      return;
    }

    const normalizedName = rawName.toLowerCase();
    const isDuplicate = seenNames.has(normalizedName);

    if (isDuplicate) {
      duplicatesCount++;
    }

    seenNames.add(normalizedName);

    const parsedRow: ParsedCsvRow = {
      rowIndex,
      raw: row,
      mapped: {
        name: rawName,
        category: rawCategory || undefined,
        notes: rawNotes || undefined,
      },
      isValid: true,
      isDuplicate,
    };

    if (options.deduplicate && isDuplicate) {
      parsedRow.isValid = false;
      parsedRow.error = 'Дубликат (пропущен)';
      invalidRows.push(parsedRow);
    } else {
      validRows.push(parsedRow);
    }
  });

  const concepts = validRows.map((r) => r.mapped);

  return {
    delimiter,
    hasHeaders,
    headers: rawHeaders,
    totalRows: dataRows.length,
    validRows,
    invalidRows,
    duplicatesCount,
    concepts,
    warnings,
  };
}

/**
 * Generates an RFC 4180 CSV template string with sample data for demonstration.
 */
export function generateCsvTemplate(domain: 'tech' | 'retail' | 'finance' = 'tech'): string {
  if (domain === 'retail') {
    return [
      'name,category,notes',
      '"Персонализация витрины","E-commerce","Динамический подбор баннеров и рекомендаций"',
      '"Омниканальность","Ритейл","Сквозная лояльность между онлайн и оффлайн точками"',
      '"Программа лояльности","Маркетинг","Кешбэк баллами и персональные промокоды"',
      '"Upsell и Cross-sell","Продажи","Допродажа сопутствующих аксессуаров в чеке"',
      '"Удержание клиентов (Retention)","Аналитика","Снижение оттока пользователей (Churn rate)"',
      '"LTV клиента","Метрики","Пожизненная ценность покупателя в когорте"',
      '"Динамическое ценообразование","Pricing","Автоматическая коррекция цен по спросу"',
      '"Быстрая доставка за 15 минут","Логистика","Дарксторы шаговой доступности"',
    ].join('\n');
  }

  if (domain === 'finance') {
    return [
      'name,category,notes',
      '"Скоринг заемщиков","FinTech","ML-оценка кредитоспособности физических лиц"',
      '"Антифрод мониторинг","Безопасность","Выявление мошеннических транзакций в реальном времени"',
      '"Open Banking API","Инфраструктура","Единый шлюз открытых банковских протоколов"',
      '"Алгоритмический трейдинг","Рынки","Высокочастотные торговые боты на бирже"',
      '"Цифровой факторинг","B2B","Финансирование дебиторской задолженности"',
      '"KYC верификация","Комплаенс","Удаленная идентификация личности по паспорту и биометрии"',
      '"Робоэдвайзинг","Инвестиции","Автоматизированное управление инвестиционным портфелем"',
    ].join('\n');
  }

  // Default: Tech / AI
  return [
    'name,category,notes',
    '"Векторный поиск","AI & Retrieval","HNSW граф для поиска ближайших соседей"',
    '"Семантические эмбеддинги","NLP","Плотные векторные представления смыслов (dense vectors)"',
    '"Мульти-агентная архитектура","AI Systems","Координация специализированных LLM-агентов"',
    '"Cross-Encoder переранжирование","Search","Точное доранжирование топ-кандидатов"',
    '"Контекстный бандит LinUCB","ML RecSys","Баланс exploration vs exploitation в рекомендациях"',
    '"Граф знаний","Knowledge Graph","Онтология связей между сущностями и свойствами"',
    '"Explainable AI","Explainability","Атрибуция признаков и объяснение рекомендаций пользователю"',
    '"Квантование векторов (PQ)","Optimization","Сжатие векторов в 4-8 раз без потери точности"',
  ].join('\n');
}

export interface CsvExportOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  includeBom?: boolean;
  columns?: Array<'name' | 'category' | 'notes' | 'id'>;
}

/**
 * Serializes concepts to CSV text for export or downloading with customizable delimiter, columns, and BOM.
 */
export function exportConceptsToCsv(
  concepts: Array<{ id?: string; name: string; category?: string; notes?: string }>,
  options: CsvExportOptions = {}
): string {
  const delimiter = options.delimiter || ',';
  const includeHeaders = options.includeHeaders !== false;
  const includeBom = Boolean(options.includeBom);
  const columns = options.columns || ['name', 'category', 'notes'];

  const escapeCsv = (str: string = '') => {
    if (
      str.includes(delimiter) ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  if (includeHeaders) {
    lines.push(columns.join(delimiter));
  }

  for (const c of concepts) {
    const rowValues = columns.map((col) => {
      if (col === 'id') return escapeCsv(c.id || '');
      if (col === 'name') return escapeCsv(c.name || '');
      if (col === 'category') return escapeCsv(c.category || '');
      if (col === 'notes') return escapeCsv(c.notes || '');
      return '';
    });
    lines.push(rowValues.join(delimiter));
  }

  const result = lines.join('\n');
  return includeBom ? `\uFEFF${result}` : result;
}

export function parseCsvToConcepts(csvText: string, options: CsvParseOptions = {}) {
  const res = parseSemanticConceptsCsv(csvText, options);
  return {
    ...res,
    errors: res.warnings.concat(res.invalidRows.map((r) => r.error || 'Invalid row')),
    stats: {
      totalRows: res.totalRows,
      importedCount: res.concepts.length,
      skippedDuplicateCount: res.duplicatesCount,
    },
  };
}

