import React, { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Bot, User } from 'lucide-react';
import { ConversationalAgent, AgentResponse } from '../lib/agent/conversational-agent';
import { CatalogItem } from '../types';

interface ConversationalViewProps {
  agent: ConversationalAgent;
  onSelectItem?: (item: CatalogItem) => void;
}

export const ConversationalView: React.FC<ConversationalViewProps> = ({
  agent,
  onSelectItem,
}) => {
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
    <div className="page" style={{ maxWidth: 840 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Conversational Vector NLU Agent</h1>
          <p className="page-sub">
            Multi-turn natural language intent extraction over 384-d embeddings with price and category constraints
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleClear}>
          <RotateCcw size={13} /> Clear session
        </button>
      </div>

      {/* Chat Stream */}
      <div
        className="card"
        style={{
          padding: 20,
          marginBottom: 16,
          minHeight: 380,
          maxHeight: '62vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-sec)' }}>
            <Bot size={32} style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
            <p style={{ fontSize: '0.875rem', marginBottom: 14 }}>
              Ask for products by concept, budget, or similarity anchor:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {[
                'подбери научно-фантастические фильмы о космосе и времени',
                'найди гаджеты и технику для работы до 30000 рублей',
                'посоветуй что-то похожее на Cyberpunk 2077',
              ].map((prompt) => (
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
              style={{
                display: 'flex',
                gap: 10,
                flexDirection: isUser ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: isUser ? 'var(--accent)' : 'var(--bg-alt)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isUser ? <User size={14} color="#fff" /> : <Bot size={14} color="var(--accent)" />}
              </div>
              <div style={{ maxWidth: '78%' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: '0.875rem',
                    background: isUser ? 'var(--accent)' : 'var(--bg-alt)',
                    color: isUser ? '#fff' : 'var(--text)',
                    border: isUser ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {msg.text}
                </div>

                {msg.items.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {msg.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItem?.(item)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 8,
                          width: '100%',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.875rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {item.icon} {item.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>
                            {item.category}
                          </div>
                        </div>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            marginLeft: 12,
                            color: 'var(--accent)',
                          }}
                        >
                          {item.price || '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {msg.explanation && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-mut)', marginTop: 4 }}>
                    {msg.explanation}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={14} color="var(--accent)" />
            </div>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                fontSize: '0.875rem',
                color: 'var(--text-sec)',
              }}
            >
              Computing 384-d intent vector...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a natural language request..."
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
