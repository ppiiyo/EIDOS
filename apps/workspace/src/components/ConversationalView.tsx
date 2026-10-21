import React, { useState, useRef, useEffect } from "react";
import { Send, RotateCcw, Bot, User } from 'lucide-react';
import { ConversationalAgent, AgentResponse } from '../lib/agent/conversational-agent';
import { CatalogItem } from '../types';
import { UiLanguage } from '../i18n/uiTranslations';

interface ConversationalViewProps {
  agent: ConversationalAgent;
  onSelectItem?: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
}

const AGENT_COPY: Record<
  UiLanguage,
  {
    title: string;
    subtitle: string;
    clearBtn: string;
    emptyHint: string;
    computingText: string;
    placeholder: string;
    prompts: string[];
  }
> = {
  ru: {
    title: 'Диалоговый Векторный NLU Агент',
    subtitle:
      'Многошаговое извлечение намерений на естественном языке в 384-d пространстве с фильтрацией бюджета и категорий',
    clearBtn: 'Очистить диалог',
    emptyHint: 'Запросите подбор по смыслу, бюджету или эталонному объекту:',
    computingText: 'Вычисление 384-d вектора намерения...',
    placeholder: 'Введите запрос на Русском, English или 日本語...',
    prompts: [
      'подбери научно-фантастические фильмы о космосе и времени',
      'найди гаджеты и технику для работы до 30000 рублей',
      'посоветуй что-то похожее на Cyberpunk 2077',
    ],
  },
  en: {
    title: 'Conversational Vector NLU Agent',
    subtitle:
      'Multi-turn natural language intent extraction over 384-d embeddings with price and category constraints',
    clearBtn: 'Clear session',
    emptyHint: 'Ask for products by concept, budget, or similarity anchor:',
    computingText: 'Computing 384-d intent vector...',
    placeholder: 'Type a natural language request in English, Русский, or 日本語...',
    prompts: [
      'recommend sci-fi movies about relativistic time and black holes',
      'find electronics and gadgets for coding and work',
      'suggest something similar to Cyberpunk 2077',
    ],
  },
  ja: {
    title: '対話型ベクトル NLU エージェント',
    subtitle:
      '384次元ベクトル空間におけるマルチターン自然言語意図抽出（カテゴリ・予算制約対応）',
    clearBtn: '履歴をクリア',
    emptyHint: 'コンセプト、カテゴリ、予算、または類似アイテムで質問してください：',
    computingText: '384次元インテントベクトルを計算中...',
    placeholder: '日本語、English、Русскийでリクエストを入力...',
    prompts: [
      '宇宙とブラックホールに関する科学ドキュメンタリーや映画を探して',
      'サイバーパンクと人工知能のゲーム実況をおすすめして',
      'RustとPythonの高速データベース開発講座を教えて',
    ],
  },
};

export const ConversationalView: React.FC<ConversationalViewProps> = ({
  agent,
  onSelectItem,
  uiLang = 'ru',
}) => {
  const copy = AGENT_COPY[uiLang];
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AgentResponse[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (customText?: string) => {
    const text = (customText ?? input).trim();
    if (!text || isTyping) return;

    if (!customText) setInput('');
    setIsTyping(true);
    setMessages((prev) => [...prev, { text, items: [] }]);

    const response = await agent.respond(text);
    setIsTyping(false);
    setMessages((prev) => [...prev, response]);
  };

  const handleClear = () => {
    agent.clearHistory();
    setMessages([]);
  };

  return (
    <div className="page max-w-[840px]">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-sub">{copy.subtitle}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleClear}>
          <RotateCcw size={13} /> {copy.clearBtn}
        </button>
      </div>

      {/* Chat Stream */}
      <div className="card p-5 mb-4 min-h-[380px] max-h-[62vh] overflow-y-auto flex flex-col gap-3.5">
        {messages.length === 0 && (
          <div className="text-center py-12 px-4 text-[var(--text-sec)]">
            <Bot size={32} className="mx-auto mb-3 text-[var(--accent)]" />
            <p className="text-sm mb-3.5">{copy.emptyHint}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {copy.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSend(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = i % 2 === 0;
          return (
            <div
              key={i}
              className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-[30px] h-[30px] rounded-full shrink-0 border border-[var(--border)] flex items-center justify-center ${
                  isUser ? 'bg-[var(--accent)]' : 'bg-[var(--bg-alt)]'
                }`}
              >
                {isUser ? <User size={14} color="#fff" /> : <Bot size={14} color="var(--accent)" />}
              </div>
              <div className="max-w-[78%]">
                <div
                  className={`px-3.5 py-2.5 rounded-[10px] text-sm ${
                    isUser
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-alt)] text-[var(--text)] border border-[var(--border)]'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.items.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    {msg.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItem?.(item)}
                        className="flex justify-between items-center px-3.5 py-2.5 rounded-lg w-full bg-[var(--surface)] border border-[var(--border)] cursor-pointer text-left text-sm"
                      >
                        <div>
                          <div className="font-semibold text-[var(--text)]">
                            {item.icon} {item.title}
                          </div>
                          <div className="text-xs text-[var(--text-sec)]">{item.category}</div>
                        </div>
                        <span className="mono font-semibold whitespace-nowrap ml-3 text-[var(--accent)]">
                          {item.price || '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {msg.explanation && (
                  <div className="text-xs text-[var(--text-mut)] mt-1">{msg.explanation}</div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-[30px] h-[30px] rounded-full bg-[var(--bg-alt)] border border-[var(--border)] flex items-center justify-center">
              <Bot size={14} color="var(--accent)" />
            </div>
            <div className="px-3.5 py-2.5 rounded-[10px] bg-[var(--bg-alt)] border border-[var(--border)] text-sm text-[var(--text-sec)]">
              {copy.computingText}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={copy.placeholder}
          disabled={isTyping}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleSend()}
          disabled={isTyping || !input.trim()}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
