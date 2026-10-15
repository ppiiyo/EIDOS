import { describe, it, expect } from 'vitest';
import {
  stripBom,
  detectDelimiter,
  parseCsvToGrid,
  detectHasHeaders,
  autoMapColumns,
  parseSemanticConceptsCsv,
  generateCsvTemplate,
  exportConceptsToCsv,
} from '../csv';

describe('CSV Parser for Semantic Concepts', () => {
  it('strips UTF-8 BOM correctly', () => {
    const withBom = '\uFEFFname,category\nTest,AI';
    expect(stripBom(withBom)).toBe('name,category\nTest,AI');
    expect(stripBom('name,category')).toBe('name,category');
  });

  it('detects delimiters (comma, semicolon, tab, pipe)', () => {
    expect(detectDelimiter('name,category,notes\nfoo,bar,baz')).toBe(',');
    expect(detectDelimiter('name;category;notes\nfoo;bar;baz')).toBe(';');
    expect(detectDelimiter('name\tcategory\tnotes\nfoo\tbar\tbaz')).toBe('\t');
    expect(detectDelimiter('name|category|notes\nfoo|bar|baz')).toBe('|');
  });

  it('parses RFC 4180 escaped quotes and multi-line fields', () => {
    const csv = 'name,notes\n"Вектор ""HNSW""","Быстрый, надежный\nи точный граф"';
    const grid = parseCsvToGrid(csv, ',');
    expect(grid.length).toBe(2);
    expect(grid[1][0]).toBe('Вектор "HNSW"');
    expect(grid[1][1]).toBe('Быстрый, надежный\nи точный граф');
  });

  it('detects header presence accurately', () => {
    expect(detectHasHeaders(['concept', 'category', 'notes'])).toBe(true);
    expect(detectHasHeaders(['Термин', 'Определение'])).toBe(true);
    expect(detectHasHeaders(['Кот', 'Собака', 'Птица'])).toBe(false);
  });

  it('auto-maps columns to concept fields', () => {
    const mapping = autoMapColumns(['Title', 'Category', 'Description']);
    expect(mapping.nameIndex).toBe(0);
    expect(mapping.categoryIndex).toBe(1);
    expect(mapping.notesIndex).toBe(2);
  });

  it('parses semantic concepts with headers and category mapping', () => {
    const csv = `name,category,notes
Нейросеть,AI,"Глубокое обучение"
Векторный поиск,Search,"HNSW алгоритм"
`;
    const result = parseSemanticConceptsCsv(csv);
    expect(result.concepts.length).toBe(2);
    expect(result.concepts[0]).toEqual({
      name: 'Нейросеть',
      category: 'AI',
      notes: 'Глубокое обучение',
    });
    expect(result.concepts[1]).toEqual({
      name: 'Векторный поиск',
      category: 'Search',
      notes: 'HNSW алгоритм',
    });
  });

  it('handles semicolon delimited files and deduplication', () => {
    const csv = `Концепт;Категория;Заметки
Эмбеддинг;NLP;Вектор
Трансформер;AI;Attention
эмбеддинг;NLP;Повтор
`;
    const result = parseSemanticConceptsCsv(csv, { deduplicate: true });
    expect(result.concepts.length).toBe(2);
    expect(result.duplicatesCount).toBe(1);
    expect(result.concepts.map((c) => c.name)).toEqual(['Эмбеддинг', 'Трансформер']);
  });

  it('handles single-column raw concept lists without headers', () => {
    const csv = `Квантование
Ранжирование
Рекомендации
`;
    const result = parseSemanticConceptsCsv(csv, { hasHeaders: false });
    expect(result.concepts.length).toBe(3);
    expect(result.concepts.map((c) => c.name)).toEqual([
      'Квантование',
      'Ранжирование',
      'Рекомендации',
    ]);
  });

  it('generates sample templates and exports back to CSV', () => {
    const template = generateCsvTemplate('tech');
    expect(template).toContain('Векторный поиск');
    const parsed = parseSemanticConceptsCsv(template);
    expect(parsed.concepts.length).toBeGreaterThan(5);

    const exported = exportConceptsToCsv(parsed.concepts);
    expect(exported).toContain('name,category,notes');
    expect(exported).toContain('Векторный поиск');
  });

  it('supports custom export options: delimiter, BOM, and columns selection', () => {
    const concepts = [
      { id: 'c-1', name: 'LinUCB Бандит', category: 'RecSys', notes: 'Exploration' },
      { id: 'c-2', name: 'HNSW Граф; Метрика', category: 'Search', notes: 'Cosine' },
    ];

    const tsv = exportConceptsToCsv(concepts, { delimiter: '\t', includeHeaders: true });
    expect(tsv).toContain('name\tcategory\tnotes');
    expect(tsv).toContain('LinUCB Бандит\tRecSys\tExploration');

    const excelCsv = exportConceptsToCsv(concepts, {
      delimiter: ';',
      includeBom: true,
      columns: ['name', 'category'],
    });
    expect(excelCsv.charCodeAt(0)).toBe(0xfeff);
    expect(excelCsv).toContain('name;category');
    expect(excelCsv).toContain('"HNSW Граф; Метрика";Search');
  });
});
