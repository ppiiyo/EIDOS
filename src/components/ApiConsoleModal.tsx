import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Play,
  Terminal,
  X,
  Server,
  Zap,
} from 'lucide-react';
import { CatalogItem } from '../types';

interface ApiConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
}

export const ApiConsoleModal: React.FC<ApiConsoleModalProps> = ({
  isOpen,
  onClose,
  catalog,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<'recommend' | 'search'>('recommend');
  const [selectedItemName, setSelectedItemName] = useState('Cyberpunk 2077');
  const [searchQuery, setSearchQuery] = useState('космос и время');
  const [limit, setLimit] = useState(3);
  const [langTab, setLangTab] = useState<'curl' | 'js' | 'python'>('curl');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(3.8);

  if (!isOpen) return null;

  const handleSendRequest = async () => {
    setIsLoading(true);
    const start = performance.now();
    await new Promise((r) => setTimeout(r, 220));
    const duration = +(performance.now() - start).toFixed(1);
    setLatency(duration);

    if (selectedEndpoint === 'recommend') {
      const res = {
        status: 'success',
        code: 200,
        model: 'e5-multilingual-small',
        execution_time_ms: duration,
        query_item: selectedItemName,
        recommendations: [
          {
            id: 2,
            title: 'Матрица',
            category: 'Фильмы',
            similarity_score: 0.894,
            confidence: 'high',
            semantic_overlap: [
              'симуляция реальности',
              'киберпанк',
              'искусственный интеллект',
            ],
            why: 'Связаны эстетикой киберпанка, вопросами искусственного интеллекта и концепцией иллюзорности привычной реальности.',
          },
          {
            id: 3,
            title: 'Дюна',
            category: 'Книги',
            similarity_score: 0.762,
            confidence: 'medium',
            semantic_overlap: ['научная фантастика', 'будущее человечества'],
            why: 'Масштабные фантастические вселенные с глубоким социальным подтекстом.',
          },
          {
            id: 13,
            title: 'Игра "Stray"',
            category: 'Игры',
            similarity_score: 0.718,
            confidence: 'medium',
            semantic_overlap: ['кибергород', 'роботы', 'неон'],
            why: 'Атмосфера ретрофутуризма и неонового кибергорода.',
          },
        ].slice(0, limit),
        metadata: {
          vector_dimensions: 64,
          engine: 'EIDOS Semantic Core v3.2',
        },
      };
      setResponseOutput(JSON.stringify(res, null, 2));
    } else {
      const res = {
        status: 'success',
        code: 200,
        model: 'e5-multilingual-small',
        execution_time_ms: duration,
        natural_query: searchQuery,
        matched_results: [
          {
            id: 7,
            title: 'Фильм "Интерстеллар"',
            category: 'Фильмы',
            semantic_score: 0.961,
            why: 'Прямое семантическое соответствие концепциям релятивистского времени и астрофизики черных дыр.',
          },
          {
            id: 3,
            title: 'Дюна',
            category: 'Книги',
            semantic_score: 0.912,
            why: 'Космическая сага о межзвездных путешествиях и временных пророчествах.',
          },
          {
            id: 12,
            title: 'Фильм "Начало"',
            category: 'Фильмы',
            semantic_score: 0.835,
            why: 'Искривление восприятия времени на разных уровнях снов.',
          },
        ].slice(0, limit),
        metadata: {
          query_prefix: 'query: ',
          engine: 'EIDOS Semantic Core v3.2',
        },
      };
      setResponseOutput(JSON.stringify(res, null, 2));
    }
    setIsLoading(false);
  };

  const getCodeSnippet = () => {
    if (selectedEndpoint === 'recommend') {
      if (langTab === 'curl') {
        return `curl -X POST https://api.eidos.ai/v1/recommend \\
  -H "Authorization: Bearer eidos_live_sk_8921f9" \\
  -H "Content-Type: application/json" \\
  -d '{
    "item": "${selectedItemName}",
    "limit": ${limit}
  }'`;
      }
      if (langTab === 'js') {
        return `const response = await fetch("https://api.eidos.ai/v1/recommend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer eidos_live_sk_8921f9",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    item: "${selectedItemName}",
    limit: ${limit}
  })
});
const data = await response.json();
console.log(data.recommendations);`;
      }
      return `import requests

url = "https://api.eidos.ai/v1/recommend"
headers = {
    "Authorization": "Bearer eidos_live_sk_8921f9",
    "Content-Type": "application/json"
}
payload = {
    "item": "${selectedItemName}",
    "limit": ${limit}
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
    } else {
      if (langTab === 'curl') {
        return `curl -X POST https://api.eidos.ai/v1/search \\
  -H "Authorization: Bearer eidos_live_sk_8921f9" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "${searchQuery}",
    "limit": ${limit}
  }'`;
      }
      if (langTab === 'js') {
        return `const response = await fetch("https://api.eidos.ai/v1/search", {
  method: "POST",
  headers: {
    "Authorization": "Bearer eidos_live_sk_8921f9",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query: "${searchQuery}",
    limit: ${limit}
  })
});
const data = await response.json();
console.log(data.matched_results);`;
      }
      return `import requests

url = "https://api.eidos.ai/v1/search"
headers = {
    "Authorization": "Bearer eidos_live_sk_8921f9",
    "Content-Type": "application/json"
}
payload = {
    "query": "${searchQuery}",
    "limit": ${limit}
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e18] border border-[#1e1e35] rounded-2xl max-w-[850px] w-full p-6 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e1e35] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#3ee89a] flex items-center justify-center text-black font-bold text-sm shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <Code2 size={16} />
            </div>
            <div>
              <div className="font-extrabold text-sm text-[#e8e8f0] mono">
                EIDOS REST API Console & Playground
              </div>
              <div className="text-[11px] text-[#8a8aa3]">
                «Рекомендательный API на основе смысла. Подключите за 5 минут».
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a8aa3] hover:text-[#e8e8f0] hover:bg-[#141424] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Endpoint Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[#141424] border border-[#1e1e35] rounded-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedEndpoint('recommend')}
              className={`px-3 py-1.5 rounded-lg text-xs mono font-bold transition-all cursor-pointer ${
                selectedEndpoint === 'recommend'
                  ? 'bg-[#00f0ff] text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
              }`}
            >
              POST /v1/recommend
            </button>
            <button
              onClick={() => setSelectedEndpoint('search')}
              className={`px-3 py-1.5 rounded-lg text-xs mono font-bold transition-all cursor-pointer ${
                selectedEndpoint === 'search'
                  ? 'bg-[#00f0ff] text-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                  : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
              }`}
            >
              POST /v1/search
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs mono text-[#8a8aa3]">
            <Server size={12} className="text-[#3ee89a]" />
            <span>Статус:</span>
            <span className="text-[#3ee89a] font-bold">200 OK (Latency: {latency}ms)</span>
          </div>
        </div>

        {/* Interactive Query Builder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#141424] border border-[#1e1e35] rounded-xl flex flex-col gap-3">
            <span className="text-xs mono uppercase text-[#8a8aa3] font-bold">
              Параметры запроса (Request Body):
            </span>

            {selectedEndpoint === 'recommend' ? (
              <div>
                <label className="text-[11px] mono text-[#8a8aa3] block mb-1">
                  Целевой товар (item):
                </label>
                <select
                  value={selectedItemName}
                  onChange={(e) => setSelectedItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0e0e18] border border-[#1e1e35] rounded-lg text-xs text-[#e8e8f0] focus:outline-none focus:border-[#00f0ff] cursor-pointer"
                >
                  {catalog.map((i) => (
                    <option key={i.id} value={i.title}>
                      {i.title} ({i.category})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-[11px] mono text-[#8a8aa3] block mb-1">
                  Естественный запрос (query):
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="космос и время / киберпанк / кофе..."
                  className="w-full px-3 py-2 bg-[#0e0e18] border border-[#1e1e35] rounded-lg text-xs text-[#e8e8f0] focus:outline-none focus:border-[#00f0ff]"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] mono text-[#8a8aa3] block mb-1">
                Лимит рекомендаций (limit): {limit}
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-[#0e0e18] rounded appearance-none cursor-pointer accent-[#00f0ff]"
              />
            </div>

            <button
              onClick={handleSendRequest}
              disabled={isLoading}
              className="mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#3ee89a] text-black font-bold text-xs mono shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:opacity-90 transition-all cursor-pointer"
            >
              <Play size={13} fill="black" />
              <span>{isLoading ? 'Выполнение запроса...' : '▶ Отправить запрос (Send)'}</span>
            </button>
          </div>

          {/* Code Snippet Box */}
          <div className="p-4 bg-[#141424] border border-[#1e1e35] rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {(['curl', 'js', 'python'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLangTab(tab)}
                    className={`px-2 py-1 rounded text-[11px] mono uppercase cursor-pointer ${
                      langTab === tab
                        ? 'bg-[#1e1e35] text-[#00f0ff] font-bold'
                        : 'text-[#8a8aa3] hover:text-[#e8e8f0]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 text-[11px] mono text-[#8a8aa3] hover:text-[#00f0ff] cursor-pointer"
              >
                {isCopied ? <Check size={12} className="text-[#3ee89a]" /> : <Copy size={12} />}
                <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>

            <pre className="p-3 bg-[#0a0a10] border border-[#1e1e35] rounded-lg text-[11px] mono text-[#e8e8f0] overflow-x-auto max-h-[160px] leading-relaxed">
              <code>{getCodeSnippet()}</code>
            </pre>
          </div>
        </div>

        {/* Live Response Output */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs mono text-[#8a8aa3]">
            <span className="flex items-center gap-1.5">
              <Terminal size={13} className="text-[#00f0ff]" /> Ответ сервера (Response Body):
            </span>
            <span className="text-[11px] text-[#3ee89a]">HTTP/2 200 OK</span>
          </div>

          <pre className="p-4 bg-[#0a0a10] border border-[#1e1e35] rounded-xl text-xs mono text-[#3ee89a] overflow-x-auto max-h-[220px] leading-relaxed">
            <code>
              {responseOutput ||
                `// Нажмите «▶ Отправить запрос (Send)» выше для выполнения боевого REST-вызова\n{\n  "status": "ready",\n  "endpoint": "https://api.eidos.ai/v1/${selectedEndpoint}",\n  "message": "Waiting for request trigger..."\n}`}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
