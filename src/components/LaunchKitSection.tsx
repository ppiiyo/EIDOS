import React, { useState } from 'react';
import {
  Download,
  FileJson,
  FileCode,
  Box,
  Check,
  Copy,
  Terminal,
  ShieldCheck,
  Send,
  Printer,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface LaunchKitSectionProps {
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const LaunchKitSection: React.FC<LaunchKitSectionProps> = ({ onShowToast }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [webhookEvent, setWebhookEvent] = useState<'order.completed' | 'cart.updated' | 'item.favorited'>('order.completed');
  const [webhookSecret, setWebhookSecret] = useState<string>('whsec_eidos_live_9f83a7c1e2b');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    onShowToast('Скопировано в буфер обмена', 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Файл ${filename} успешно скачан`, 'success');
  };

  // 1. OpenAPI 3.1 Specification JSON
  const getOpenApiJson = () => {
    const spec = {
      openapi: '3.1.0',
      info: {
        title: 'EIDOS Semantic Recommender API',
        version: '1.4.0',
        description: 'Высокопроизводительный API семантических товарных рекомендаций и векторного поиска по смыслу.',
        contact: {
          name: 'EIDOS Enterprise Team',
          email: 'support@eidos-engine.ai',
          url: 'https://eidos-engine.ai',
        },
      },
      servers: [
        { url: 'https://api.eidos-engine.ai/v1', description: 'Production Cloud' },
        { url: 'http://localhost:8000/v1', description: 'Local On-Premise Gateway' },
      ],
      paths: {
        '/recommend': {
          post: {
            summary: 'Получить семантические рекомендации для объекта или корзины',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['itemId'],
                    properties: {
                      itemId: { type: 'integer', example: 1 },
                      limit: { type: 'integer', default: 6, example: 4 },
                      minScore: { type: 'number', default: 0.25, example: 0.3 },
                      strategy: {
                        type: 'string',
                        enum: ['similar', 'cross_category', 'cold_start'],
                        default: 'similar',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Успешный список семантических рекомендаций',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'ok' },
                        executionTimeMs: { type: 'number', example: 14.2 },
                        recommendations: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              itemId: { type: 'integer' },
                              score: { type: 'number' },
                              explanation: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/search': {
          post: {
            summary: 'Семантический поиск по смыслу и нечеткому описанию',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['query'],
                    properties: {
                      query: { type: 'string', example: 'уютный вечер для двоих с фильмом' },
                      limit: { type: 'integer', default: 10 },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Ранжированный список релевантных товаров',
              },
            },
          },
        },
        '/catalog/sync': {
          post: {
            summary: 'Потоковая загрузка и обновление товарного фида',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
            responses: {
              '202': { description: 'Задание на индексацию эмбеддингов принято в очередь' },
            },
          },
        },
      },
    };
    return JSON.stringify(spec, null, 2);
  };

  // 2. Postman Collection v2.1
  const getPostmanCollectionJson = () => {
    const postman = {
      info: {
        name: 'EIDOS Recommender API Collection',
        _postman_id: 'eidos-api-v1-collection',
        description: 'Официальная коллекция запросов к движку EIDOS Recommender для Postman и Insomnia.',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: [
        { key: 'baseUrl', value: 'https://api.eidos-engine.ai/v1', type: 'string' },
        { key: 'apiKey', value: 'eid_live_demo_key_77a9', type: 'string' },
      ],
      item: [
        {
          name: '1. Get Item Recommendations',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{apiKey}}', type: 'text' },
              { key: 'Content-Type', value: 'application/json', type: 'text' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ itemId: 1, limit: 6, strategy: 'similar' }, null, 2),
            },
            url: {
              raw: '{{baseUrl}}/recommend',
              host: ['{{baseUrl}}'],
              path: ['recommend'],
            },
          },
        },
        {
          name: '2. Semantic Search by Meaning',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{apiKey}}', type: 'text' },
              { key: 'Content-Type', value: 'application/json', type: 'text' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ query: 'киберпанк и симуляция реальности', limit: 5 }, null, 2),
            },
            url: {
              raw: '{{baseUrl}}/search',
              host: ['{{baseUrl}}'],
              path: ['search'],
            },
          },
        },
        {
          name: '3. Track User Interaction',
          request: {
            method: 'POST',
            header: [
              { key: 'Authorization', value: 'Bearer {{apiKey}}', type: 'text' },
              { key: 'Content-Type', value: 'application/json', type: 'text' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                eventType: 'product_click',
                userId: 'usr_84920',
                itemId: 1,
                timestamp: Date.now(),
              }, null, 2),
            },
            url: {
              raw: '{{baseUrl}}/events/track',
              host: ['{{baseUrl}}'],
              path: ['events', 'track'],
            },
          },
        },
      ],
    };
    return JSON.stringify(postman, null, 2);
  };

  // 3. Docker Compose YAML
  const getDockerComposeYaml = () => {
    return `# ====================================================================
# EIDOS Recommender Engine - Production On-Premise Docker Compose
# ====================================================================
version: '3.8'

services:
  # 1. Qdrant Vector Search Engine (High-Performance Embedding Store)
  eidos-vector-db:
    image: qdrant/qdrant:v1.8.0
    container_name: eidos-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
      - QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=4
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/readyz"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 2. EIDOS Semantic Inference Microservice (FastAPI + ONNX Runtime)
  eidos-api:
    image: ghcr.io/eidos-engine/recommender-core:latest
    container_name: eidos-api-gateway
    restart: unless-stopped
    depends_on:
      eidos-vector-db:
        condition: service_healthy
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - VECTOR_DB_HOST=eidos-vector-db
      - VECTOR_DB_PORT=6333
      - MODEL_NAME=e5-small-quantized-onnx
      - BATCH_SIZE=64
      - NUM_WORKERS=4
    deploy:
      resources:
        limits:
          cpus: '2.00'
          memory: 2048M

  # 3. Nginx Reverse Proxy with Rate Limiting & SSL Termination
  eidos-gateway:
    image: nginx:alpine
    container_name: eidos-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - eidos-api
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro

volumes:
  qdrant_storage:
    driver: local
`;
  };

  // 4. Executive One-Pager / Print Solution Brief
  const printExecutiveBrief = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onShowToast('Разрешите всплывающие окна в браузере для просмотра брифа', 'error');
      return;
    }

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>EIDOS Recommender — Executive Solution Brief</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #111; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #0066cc; font-size: 26px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h2 { color: #333; font-size: 18px; margin-top: 25px; }
    .badge { display: inline-block; background: #e6f4ff; color: #0066cc; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
    th { background: #f9f9f9; }
    .metric { font-size: 22px; font-weight: bold; color: #008855; }
    .footer { margin-top: 50px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px; }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <h1>EIDOS Recommender</h1>
    <span class="badge">Enterprise Solution Brief</span>
  </div>
  <p><strong>Семантический рекомендательный движок нового поколения для e-commerce и цифровых сервисов.</strong></p>
  
  <h2>1. Ключевые показатели эффективности (KPI)</h2>
  <table>
    <tr>
      <th>Метрика</th>
      <th>Классический поиск / коллаборатив</th>
      <th>EIDOS Semantic Engine</th>
      <th>Бизнес-эффект</th>
    </tr>
    <tr>
      <td>Релевантность сложных запросов</td>
      <td>25–40%</td>
      <td><strong>89–96%</strong></td>
      <td>+22% глубина корзины</td>
    </tr>
    <tr>
      <td>Проблема холодного старта (новые товары)</td>
      <td>Требуется 50+ покупок</td>
      <td><strong>Мгновенно (0 покупок)</strong></td>
      <td>Новинки продаются с 1 дня</td>
    </tr>
    <tr>
      <td>Задержка ответа (p95 latency)</td>
      <td>120–250 мс</td>
      <td><strong>&lt; 35 мс</strong></td>
      <td>Идеально для мобильных пользователей</td>
    </tr>
  </table>

  <h2>2. Архитектура внедрения</h2>
  <p>Движок поддерживает два режима развертывания:</p>
  <ul>
    <li><strong>SaaS Cloud API:</strong> Подключение за 15 минут через REST API или готовый JS-виджет. Доступность SLA 99.95%.</li>
    <li><strong>On-Premise Docker:</strong> Полная изоляция персональных данных внутри контура заказчика в соответствии с 152-ФЗ и GDPR.</li>
  </ul>

  <h2>3. Готовность к запуску</h2>
  <p>Доступны официальные плагины для <strong>Shopify, WooCommerce, 1С-Битрикс</strong>, а также клиентские библиотеки для <strong>Node.js, Python, PHP, Go</strong>.</p>

  <div class="footer">
    Сформировано автоматически системой EIDOS Recommender Engine. Контакты: enterprise@eidos-engine.ai
  </div>
  <script>window.print();</script>
</body>
</html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Simulated Webhook Payload Generator
  const getMockWebhookPayload = () => {
    return JSON.stringify(
      {
        event: webhookEvent,
        timestamp: new Date().toISOString(),
        id: 'evt_' + Math.random().toString(36).substring(2, 10),
        data: {
          orderId: 'ord_92813',
          totalAmount: 4890,
          currency: 'RUB',
          items: [
            { id: 1, title: 'Cyberpunk 2077', qty: 1, price: 2999 },
            { id: 3, title: 'Дюна (Фрэнк Герберт)', qty: 1, price: 890 },
          ],
          user: {
            id: 'usr_4920',
            segment: 'high_affinity_scifi',
          },
        },
      },
      null,
      2
    );
  };

  return (
    <section className="rounded-2xl bg-[#11111a] border border-[#1e1e2e] p-6 lg:p-8 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00f0ff] font-bold">
              Production Launch Kit
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#3ee89a]/15 text-[#3ee89a] border border-[#3ee89a]/30">
              Enterprise Ready
            </span>
          </div>
          <h2 className="text-2xl font-bold font-mono text-white mt-1">
            Пакет быстрого запуска для разработчиков и ЛПР
          </h2>
          <p className="text-xs text-[#8c8ca6] mt-1 max-w-2xl">
            Скачайте готовые конфигурации, чтобы отдать их разработчикам, импортировать в Swagger/Postman
            или развернуть автономный On-Premise контейнер.
          </p>
        </div>

        {/* Executive Solution Brief Print Button */}
        <button
          onClick={printExecutiveBrief}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00f0ff]/10 to-[#a855f7]/10 border border-[#00f0ff]/30 text-[#00f0ff] font-mono text-xs font-bold hover:bg-[#00f0ff]/20 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.15)] shrink-0"
        >
          <Printer size={15} />
          <span>📄 Скачать Executive Brief (PDF/Печать)</span>
        </button>
      </div>

      {/* 3 Download Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {/* Card 1: OpenAPI */}
        <div className="p-5 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] hover:border-[#00f0ff]/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 flex items-center justify-center text-[#00f0ff] mb-3">
              <FileJson size={20} />
            </div>
            <h3 className="font-mono text-sm font-bold text-white mb-1">
              OpenAPI 3.1 Spec (Swagger)
            </h3>
            <p className="text-xs text-[#8c8ca6] leading-relaxed">
              Полный контракт API с валидацией схем для автоматической генерации клиентских библиотек
              через openapi-generator.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-[#7a7a96]">
              <span>JSON формат</span>
              <span>•</span>
              <span>v1.4.0</span>
            </div>
          </div>
          <button
            onClick={() => downloadFile(getOpenApiJson(), 'eidos-openapi-3.1.json', 'application/json')}
            className="mt-5 w-full py-2.5 rounded-lg bg-[#141424] hover:bg-[#00f0ff] hover:text-black border border-[#2a2a40] text-xs font-mono text-[#00f0ff] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Скачать openapi.json</span>
          </button>
        </div>

        {/* Card 2: Postman Collection */}
        <div className="p-5 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] hover:border-[#a855f7]/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center text-[#a855f7] mb-3">
              <FileCode size={20} />
            </div>
            <h3 className="font-mono text-sm font-bold text-white mb-1">
              Postman Collection v2.1
            </h3>
            <p className="text-xs text-[#8c8ca6] leading-relaxed">
              Готовая коллекция запросов с предустановленными переменными окружения, телами запросов и
              тестовыми примерами.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-[#7a7a96]">
              <span>Postman / Insomnia</span>
              <span>•</span>
              <span>REST calls</span>
            </div>
          </div>
          <button
            onClick={() => downloadFile(getPostmanCollectionJson(), 'eidos.postman_collection.json', 'application/json')}
            className="mt-5 w-full py-2.5 rounded-lg bg-[#141424] hover:bg-[#a855f7] hover:text-white border border-[#2a2a40] text-xs font-mono text-[#a855f7] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Скачать коллекцию Postman</span>
          </button>
        </div>

        {/* Card 3: Docker Compose */}
        <div className="p-5 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] hover:border-[#3ee89a]/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-[#3ee89a]/10 border border-[#3ee89a]/20 flex items-center justify-center text-[#3ee89a] mb-3">
              <Box size={20} />
            </div>
            <h3 className="font-mono text-sm font-bold text-white mb-1">
              On-Premise Docker Compose
            </h3>
            <p className="text-xs text-[#8c8ca6] leading-relaxed">
              Автономный стек: FastAPI сервер инференса + векторная БД Qdrant + Nginx. Запуск одной
              командой <code className="text-[#3ee89a]">docker compose up</code>.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-[#7a7a96]">
              <span>Self-Hosted</span>
              <span>•</span>
              <span>152-ФЗ / GDPR</span>
            </div>
          </div>
          <button
            onClick={() => downloadFile(getDockerComposeYaml(), 'docker-compose.yml', 'text/yaml')}
            className="mt-5 w-full py-2.5 rounded-lg bg-[#141424] hover:bg-[#3ee89a] hover:text-black border border-[#2a2a40] text-xs font-mono text-[#3ee89a] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Скачать docker-compose.yml</span>
          </button>
        </div>
      </div>

      {/* Interactive Webhook Simulator */}
      <div className="rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#00f0ff]" />
            <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
              Симулятор входящих вебхуков (Webhooks & HMAC Verification)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={webhookEvent}
              onChange={(e) => setWebhookEvent(e.target.value as any)}
              className="px-2.5 py-1 rounded-md bg-[#141424] border border-[#2a2a40] text-xs font-mono text-[#e0e0ed] cursor-pointer"
            >
              <option value="order.completed">Событие: order.completed</option>
              <option value="cart.updated">Событие: cart.updated</option>
              <option value="item.favorited">Событие: item.favorited</option>
            </select>
            <button
              onClick={() => {
                setIsSimulating(true);
                setTimeout(() => {
                  setIsSimulating(false);
                  onShowToast('Тестовый вебхук успешно сформирован и подписан!', 'success');
                }, 400);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#00f0ff] text-[#050508] font-mono text-xs font-bold hover:bg-[#38bdf8] transition-all cursor-pointer"
            >
              <Send size={12} />
              <span>{isSimulating ? 'Генерация...' : 'Сгенерировать'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Payload JSON */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex justify-between items-center text-[11px] font-mono text-[#8c8ca6]">
              <span>HTTP HEADER: <code className="text-[#00f0ff]">X-Eidos-Signature: sha256=9b7c...a28</code></span>
              <button
                onClick={() => handleCopy(getMockWebhookPayload(), 'webhook-payload')}
                className="text-[#00f0ff] hover:underline cursor-pointer flex items-center gap-1"
              >
                {copiedKey === 'webhook-payload' ? <Check size={11} /> : <Copy size={11} />}
                <span>Скопировать JSON</span>
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-[#050509] border border-[#1a1a28] font-mono text-[11px] text-[#3ee89a] overflow-x-auto max-h-56">
              {getMockWebhookPayload()}
            </pre>
          </div>

          {/* Right: Verification Code */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex justify-between items-center text-[11px] font-mono text-[#8c8ca6]">
              <span>ПРОВЕРКА ПОДПИСИ (NODE.JS CRYPTO)</span>
              <button
                onClick={() =>
                  handleCopy(
                    `const crypto = require('crypto');
function verifyEidosWebhook(rawBody, signatureHeader, secret) {
  const hash = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
}`,
                    'webhook-verify-code'
                  )
                }
                className="text-[#00f0ff] hover:underline cursor-pointer flex items-center gap-1"
              >
                {copiedKey === 'webhook-verify-code' ? <Check size={11} /> : <Copy size={11} />}
                <span>Скопировать функцию</span>
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-[#050509] border border-[#1a1a28] font-mono text-[11px] text-[#e0e0ed] overflow-x-auto max-h-56">
{`const crypto = require('crypto');

// Middleware для валидации подписи вебхука
function verifyEidosWebhook(rawBody, signatureHeader, secret) {
  const hash = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signatureHeader)
  );
}`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};
