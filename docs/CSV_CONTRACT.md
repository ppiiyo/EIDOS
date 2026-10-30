# EIDOS v3.4.0 — Client CSV & JSON Catalog Contract

This specification defines the file format and REST API schema for importing product catalogs into EIDOS Studio UI or `POST /v1/catalog/upsert`.

---

## 1. Field Specification

| Field | Requirement | Type | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | **Required** | `string` | `1..100` chars | Unique product/document identifier |
| `title` | **Required** | `string` | `1..500` chars | Primary product title indexed in both HNSW (384-d) and BM25 |
| `description` | Recommended | `string` | `0..2000` chars | Full text description, specifications, and use-cases |
| `price` | Recommended | `number` | `>= 0` | Numeric price (currency symbols in CSV are stripped automatically) |
| `category` | Recommended | `string` | `1..100` chars | Category name used for faceting, MMR diversity, and intent matching |
| `sku` | Recommended | `string` | `1..100` chars | Vendor SKU or part number for exact lexical lookup |
| `brand` | Recommended | `string` | `1..100` chars | Brand / manufacturer name |
| `tags` | Optional | `string[]` | Up to 20 tags | Semicolon (`;`) or pipe (`\|`) separated tags in CSV; string array in JSON |
| `inStock` | Optional | `boolean` | `true` / `false` | Inventory availability flag (defaults to `true`) |

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
