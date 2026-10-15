import React, { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Bot, User } from 'lucide-react';
import { ConversationalAgent, AgentResponse } from '../lib/agent/conversational-agent';
import { CatalogItem } from '../types';

interface ConversationalViewProps {
  agent: ConversationalAgent;
  onSelectItem?: (item: CatalogItem) => void;
}

export const ConversationalView: React.FC<ConversationalViewProps> = ({
  agent, onSelectItem,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AgentResponse[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput('');
    setIsTyping(true);
    setMessages(prev => [...prev, { text, items: [] }]); // user message

    const response = await agent.respond(text);
    setIsTyping(false);
    setMessages(prev => [...prev, response]);
  };

  const handleClear = () => {
    agent.clearHistory();
    setMessages([]);
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Conversational Search</h1>
          <p className="page-sub">Natural language queries over your catalog</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleClear}>
          <RotateCcw size={13}/> Clear
        </button>
      </div>

      {/* Сообщения */}
      <div style={{
        display:'flex', flexDirection:'column', gap:12,
        marginBottom:16, maxHeight:'60vh', overflowY:'auto', padding:'4px 0',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-mut)' }}>
            <Bot size={32} style={{ margin:'0 auto 12px', opacity:.4 }}/>
            <p style={{ fontSize:'0.875rem' }}>
              Попробуйте: «найди механическую клавиатуру до 10000 рублей» или «похожие на матрицу»
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = i % 2 === 0;
          return (
            <div key={i} style={{
              display:'flex', gap:10,
              flexDirection: isUser ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width:28, height:28, borderRadius:'50%', flexShrink:0,
                background: isUser ? '#111827' : '#EFF6FF',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {isUser
                  ? <User size={14} color="#fff"/>
                  : <Bot size={14} color="var(--accent)"/>}
              </div>
              <div style={{ maxWidth:'80%' }}>
                <div style={{
                  padding:'10px 14px', borderRadius:12, fontSize:'0.875rem',
                  background: isUser ? '#111827' : '#fff',
                  color: isUser ? '#fff' : 'var(--text)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                }}>
                  {msg.text}
                </div>

                {/* Карточки товаров */}
                {msg.items.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                    {msg.items.map(item => (
                      <button key={item.id}
                        onClick={() => onSelectItem?.(item)}
                        style={{
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          padding:'10px 14px', borderRadius:8, width:'100%',
                          background:'#fff', border:'1px solid var(--border)',
                          cursor:'pointer', textAlign:'left', fontSize:'0.875rem',
                        }}>
                        <div>
                          <div style={{ fontWeight:500, color: 'var(--text)' }}>{item.title}</div>
                          <div style={{ fontSize:'0.75rem', color:'var(--text-sec)' }}>
                            {item.category}
                          </div>
                        </div>
                        <span style={{ fontWeight:600, whiteSpace:'nowrap', marginLeft:12, color: 'var(--text)' }}>
                          {item.price || '$99.00'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {msg.explanation && (
                  <div style={{ fontSize:'0.75rem', color:'var(--text-mut)', marginTop:4 }}>
                    {msg.explanation}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div style={{ display:'flex', gap:10 }}>
            <div style={{
              width:28, height:28, borderRadius:'50%', background:'#EFF6FF',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Bot size={14} color="var(--accent)"/>
            </div>
            <div style={{ padding:'10px 14px', borderRadius:12, background:'#fff',
              border:'1px solid var(--border)', fontSize:'0.875rem', color:'var(--text-mut)' }}>
              Ищу…
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Инпут */}
      <div style={{ display:'flex', gap:8 }}>
        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Введите запрос…"
          disabled={isTyping}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={isTyping || !input.trim()}>
          <Send size={15}/>
        </button>
      </div>
    </div>
  );
};
