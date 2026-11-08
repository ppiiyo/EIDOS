# EIDOS v3.4.0 — Client CSV & JSON Catalog Contract

This specification defines the file format and REST API schema for importing product catalogs into EIDOS Studio UI or `POST /v1/catalog/upsert`.

---

## 1. Field Specification

| Field | Requirement | Type | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | **Required** | `string` | `1..100` chars | Unique product/document identifier |
| `title` | **Required** | `string` | `1..500` chars | Primary product title indexed in HNSW (384-d) and multi-field BM25 (`fieldBoosts.title`, default `3`) |
| `description` | Recommended | `string` | `0..2000` chars | Full text description and specifications (`fieldBoosts.description`, default `1`) |
| `price` | Recommended | `number` | `>= 0` | Numeric price used by structured filters (`filters.priceMin`, `filters.priceMax`) |
| `category` | Recommended | `string` | `1..100` chars | Category name used for `filters.category`, `simpleCategoryGate`, and `fieldBoosts.category` (default `1.5`) |
| `sku` | Recommended | `string` | `1..100` chars | Vendor SKU or part number for exact lexical lookup (`fieldBoosts.sku`, default `5`; falls back to `id` if omitted) |
| `brand` | Recommended | `string` | `1..100` chars | Brand / manufacturer name used in `filters.brand` and `fieldBoosts.brand` (default `2`) |
| `inStock` | Optional | `boolean` | `true` / `false` | Inventory availability flag used by `filters.inStock` (defaults to `true` or `stock > 0`) |
| `stock` | Optional | `number` | `>= 0` (int) | Numeric inventory quantity (`inStock` is true when `inStock === true` or `stock > 0`) |
| `url` | Optional | `string` | `1..500` chars | Product card URL (falls back to `/product/<id>` if omitted) |
| `imageUrl` | Optional | `string \| null` | `1..1000` chars | Product thumbnail URL (`null` if omitted) |
| `tags` | Optional | `string[]` | Up to 20 tags | Semicolon (`;`) or pipe (`\|`) separated tags in CSV; string array in JSON |

---

## 2. Example CSV File (`examples/sample-catalog.csv`)

- **Encoding**: UTF-8
- **Delimiter**: Comma (`,`)
- **Quoting**: RFC 4180 double quotes (`"..."`) for values containing commas or spaces.

```csv
id,title,category,price,sku,brand,description,tags
custom-1,"Беспроводные наушники Sony WH-1000XM5",Аудио,29990,SNY-WH1000XM5,Sony,"Флагманские наушники с активным шумоподавлением ANC, 30 часов автономной работы, LDAC Bluetooth","наушники;sony;anc;bluetooth;музыка"
custom-2,"Механическая клавиатура Keychron Q1 Pro",Периферия,16900,KCH-Q1PRO,Keychron,"Алюминиевый корпус CNC, беспроводная QMK/VIA клавиатура, переключатели Gateron, Hot-Swap","клавиатура;keychron;механика;гейминг;офис"
```

---

## 3. REST API Upsert & Error Format (`POST /v1/catalog/upsert`)

### Request
```bash
curl -X POST http://localhost:3000/v1/catalog/upsert \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $EIDOS_ADMIN_KEY" \
  -d '{
    "items": [
      {
        "id": "custom-1",
        "title": "Беспроводные наушники Sony WH-1000XM5",
        "category": "Аудио",
        "price": 29990,
        "sku": "SNY-WH1000XM5",
        "brand": "Sony",
        "description": "Флагманские наушники с активным шумоподавлением ANC",
        "tags": ["наушники", "sony", "anc"]
      }
    ]
  }'
```

### Validation Error Response (`400 Bad Request`)
When required fields (`id`, `title`) are missing or `price` is negative, EIDOS returns `400 Bad Request` with exact row and field attribution:

```json
{
  "statusCode": 400,
  "error": "Validation Error",
  "message": "row 1 (items[0]): field \"title\": Required",
  "upserted": 0,
  "failed": 1,
  "errors": [
    "row 1 (items[0]): field \"title\": Required"
  ]
}
```
