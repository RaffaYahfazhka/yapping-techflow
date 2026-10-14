'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { css, keyframes } from '@emotion/css';
import { Ticket } from '../SubordinateModal';

export interface KhansaChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets?: Ticket[];
  activeTicket?: Ticket | null;
  onSelectTicketKey?: (key: string) => void;
  initialTicketKey?: string;
  autoRequestPrompt?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  antigravityPrompt?: string | null;
  recommendedModel?: string;
  reasoningLevel?: 'Low' | 'Medium' | 'High';
  figmaUrl?: string | null;
  ticketKey?: string | null;
}

// -------------------------------------------------------------
// Animations
// -------------------------------------------------------------
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 15px rgba(244, 63, 94, 0.4), 0 0 30px rgba(251, 191, 36, 0.2);
  }
  50% {
    box-shadow: 0 0 25px rgba(244, 63, 94, 0.7), 0 0 45px rgba(251, 191, 36, 0.35);
  }
`;

const floatAnim = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
`;

// -------------------------------------------------------------
// Emotion CSS Styles
// -------------------------------------------------------------
const styles = {
  overlay: css`
    position: fixed;
    inset: 0;
    z-index: 130;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(3, 4, 8, 0.78);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  `,

  dialogContainer: css`
    position: relative;
    width: 100%;
    max-width: 1000px;
    height: 90vh;
    max-height: 840px;
    display: flex;
    flex-direction: column;
    background: #0c0d12;
    border: 1px solid rgba(244, 63, 94, 0.3);
    border-radius: 24px;
    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
    color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `,

  modalHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 22px;
    background: linear-gradient(90deg, #161219 0%, #111218 50%, #161219 100%);
    border-bottom: 1px solid rgba(244, 63, 94, 0.2);
    flex-shrink: 0;
    gap: 16px;
  `,

  headerLeft: css`
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  `,

  avatarBox: css`
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 18px;
    overflow: hidden;
    border: 2px solid #f43f5e;
    box-shadow: 0 4px 18px rgba(244, 63, 94, 0.35);
    flex-shrink: 0;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  crownBadge: css`
    position: absolute;
    bottom: -3px;
    right: -3px;
    background: linear-gradient(135deg, #fbbf24, #d97706);
    border: 1.5px solid #0c0d12;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  `,

  headerInfo: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  headerTitleRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,

  headerTitle: css`
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
  `,

  rolePill: css`
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(244, 63, 94, 0.16);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-family: ui-monospace, monospace;
  `,

  headerSub: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: #a1a1aa;
  `,

  modelTag: css`
    font-size: 11px;
    font-weight: 700;
    font-family: ui-monospace, monospace;
    padding: 2px 8px;
    border-radius: 6px;
    background: rgba(56, 189, 248, 0.14);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  `,

  headerRight: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  `,

  clearBtn: css`
    padding: 6px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #a1a1aa;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  `,

  closeBtn: css`
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e4e4e7;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    &:hover {
      background: rgba(244, 63, 94, 0.25);
      border-color: rgba(244, 63, 94, 0.5);
      color: #ffffff;
    }
  `,

  // Ticket Context Bar
  ticketBar: css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: #111218;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    overflow-x: auto;
    flex-shrink: 0;
  `,

  ticketBarLabel: css`
    font-size: 11px;
    font-weight: 800;
    color: #fb7185;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: ui-monospace, monospace;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 5px;
  `,

  ticketPill: (isActive: boolean) => css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    border: 1px solid ${isActive ? 'rgba(244, 63, 94, 0.6)' : 'rgba(255, 255, 255, 0.08)'};
    background: ${isActive ? 'rgba(244, 63, 94, 0.18)' : 'rgba(255, 255, 255, 0.03)'};
    color: ${isActive ? '#fecdd3' : '#a1a1aa'};

    &:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
  `,

  activeTicketActionRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 20px;
    background: rgba(244, 63, 94, 0.06);
    border-bottom: 1px solid rgba(244, 63, 94, 0.15);
    flex-wrap: wrap;
    flex-shrink: 0;
  `,

  ticketQuickDetails: css`
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    min-width: 0;
  `,

  generatePromptBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 9px;
    background: linear-gradient(135deg, #e11d48, #be123c);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 10px rgba(225, 29, 72, 0.35);

    &:hover {
      background: linear-gradient(135deg, #f43f5e, #e11d48);
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(244, 63, 94, 0.5);
    }
  `,

  // Chat Area
  chatStream: css`
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    background: #090a0e;
  `,

  messageRow: (isUser: boolean) => css`
    display: flex;
    justify-content: ${isUser ? 'flex-end' : 'flex-start'};
    gap: 12px;
    max-width: 100%;
  `,

  msgAvatar: css`
    width: 36px;
    height: 36px;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1.5px solid rgba(244, 63, 94, 0.5);
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  bubble: (isUser: boolean) => css`
    max-width: 82%;
    padding: 14px 18px;
    border-radius: ${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
    background: ${isUser
      ? 'linear-gradient(135deg, #1e293b, #0f172a)'
      : 'linear-gradient(135deg, #17151e, #111218)'};
    border: 1px solid ${isUser ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)'};
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    color: #f4f4f5;
    font-size: 13.5px;
    line-height: 1.6;
    word-break: break-word;
  `,

  bubbleHeader: (isUser: boolean) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 6px;
    font-size: 11px;
    color: ${isUser ? '#38bdf8' : '#fb7185'};
    font-weight: 700;
    font-family: ui-monospace, monospace;
  `,

  // Antigravity Prompt Highlight Box
  promptBox: css`
    margin-top: 14px;
    padding: 16px;
    border-radius: 14px;
    background: #07080c;
    border: 1px solid rgba(16, 185, 129, 0.4);
    box-shadow: 0 4px 25px rgba(16, 185, 129, 0.1);
  `,

  promptBoxHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
  `,

  badgeRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,

  modelBadge: (level?: string) => {
    let bg = 'rgba(56, 189, 248, 0.15)';
    let border = 'rgba(56, 189, 248, 0.35)';
    let text = '#38bdf8';
    if (level === 'High') {
      bg = 'rgba(244, 63, 94, 0.18)';
      border = 'rgba(244, 63, 94, 0.45)';
      text = '#fb7185';
    } else if (level === 'Low') {
      bg = 'rgba(16, 185, 129, 0.15)';
      border = 'rgba(16, 185, 129, 0.4)';
      text = '#34d399';
    }
    return css`
      font-size: 11px;
      font-weight: 800;
      font-family: ui-monospace, monospace;
      padding: 3px 9px;
      border-radius: 7px;
      background: ${bg};
      border: 1px solid ${border};
      color: ${text};
      display: inline-flex;
      align-items: center;
      gap: 5px;
    `;
  },

  figmaBadge: css`
    font-size: 11px;
    font-weight: 700;
    font-family: ui-monospace, monospace;
    padding: 3px 9px;
    border-radius: 7px;
    background: rgba(192, 132, 252, 0.15);
    border: 1px solid rgba(192, 132, 252, 0.35);
    color: #c084fc;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
    &:hover {
      background: rgba(192, 132, 252, 0.25);
      color: #e9d5ff;
    }
  `,

  copyBtn: (copied: boolean) => css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    background: ${copied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)'};
    border: 1px solid ${copied ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.15)'};
    color: ${copied ? '#34d399' : '#ffffff'};

    &:hover {
      background: ${copied ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.15)'};
    }
  `,

  promptCodeView: css`
    max-height: 220px;
    overflow-y: auto;
    background: #020305;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    line-height: 1.5;
    color: #d1d5db;
    white-space: pre-wrap;
    word-break: break-all;
  `,

  // Suggested Prompts
  quickPromptsBar: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    background: #0f1015;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    flex-shrink: 0;
  `,

  quickPromptBtn: css`
    padding: 5px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d4d4d8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    &:hover {
      background: rgba(244, 63, 94, 0.15);
      border-color: rgba(244, 63, 94, 0.4);
      color: #fda4af;
    }
  `,

  // Input Area
  inputContainer: css`
    padding: 14px 20px;
    background: #111218;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    gap: 12px;
    align-items: flex-end;
    flex-shrink: 0;
  `,

  inputField: css`
    flex: 1;
    min-height: 44px;
    max-height: 120px;
    padding: 12px 14px;
    background: #161720;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    color: #ffffff;
    font-size: 13.5px;
    line-height: 1.4;
    resize: none;
    outline: none;
    font-family: inherit;

    &::placeholder {
      color: #71717a;
    }
    &:focus {
      border-color: #f43f5e;
      box-shadow: 0 0 0 1px rgba(244, 63, 94, 0.4);
    }
  `,

  sendBtn: (disabled: boolean) => css`
    height: 44px;
    padding: 0 20px;
    border-radius: 12px;
    background: ${disabled
      ? 'rgba(255, 255, 255, 0.08)'
      : 'linear-gradient(135deg, #f43f5e, #be123c)'};
    border: 1px solid ${disabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(244, 63, 94, 0.5)'};
    color: ${disabled ? '#71717a' : '#ffffff'};
    font-size: 13px;
    font-weight: 700;
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.18s ease;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(244, 63, 94, 0.45);
    }
  `,

  typingIndicator: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 10px 16px;
    border-radius: 16px;
    background: rgba(244, 63, 94, 0.1);
    border: 1px solid rgba(244, 63, 94, 0.25);
    color: #fb7185;
    font-size: 12px;
    font-weight: 600;
  `,
};

function renderInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ color: '#ffffff', fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '11.5px',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '4px',
            color: '#fbbf24',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            style={{
              color: '#38bdf8',
              textDecoration: 'underline',
              wordBreak: 'break-all',
            }}
          >
            {linkMatch[1]}
          </a>
        );
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderCleanBubbleContent(rawContent: string, hasPrompt: boolean) {
  let content = rawContent;
  if (hasPrompt) {
    content = content.replace(/```(?:markdown)?[\s\S]*?```/g, '').trim();
    content = content.replace(/###\s*📋\s*Prompt Antigravity[\s\S]*?$/i, '').trim();
    content = content.replace(/---\s*$/g, '').trim();
  }

  const lines = content.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} style={{ height: '3px' }} />;
        }

        if (trimmed === '---') {
          return (
            <hr
              key={idx}
              style={{
                border: 'none',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                margin: '6px 0',
              }}
            />
          );
        }

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          return (
            <div
              key={idx}
              style={{
                fontWeight: 800,
                fontSize: '13px',
                color: '#fb7185',
                marginTop: '6px',
                marginBottom: '2px',
                letterSpacing: '-0.01em',
              }}
            >
              {renderInlineFormatting(trimmed.replace(/^#{2,3}\s*/, ''))}
            </div>
          );
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                paddingLeft: '4px',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: '#fb7185', marginTop: '1px' }}>•</span>
              <div style={{ flex: 1 }}>
                {renderInlineFormatting(trimmed.replace(/^[*\-]\s*/, ''))}
              </div>
            </div>
          );
        }

        return (
          <div key={idx} style={{ fontSize: '13px', lineHeight: 1.55 }}>
            {renderInlineFormatting(trimmed)}
          </div>
        );
      })}
    </div>
  );
}

export default function KhansaChatModal({
  isOpen,
  onClose,
  tickets = [],
  activeTicket: propActiveTicket,
  onSelectTicketKey,
  initialTicketKey,
  autoRequestPrompt = false,
}: KhansaChatModalProps) {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTicketKey, setSelectedTicketKey] = useState<string>(
    initialTicketKey || propActiveTicket?.key || tickets[0]?.key || 'TECH-777'
  );

  const streamEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync prop ticket
  useEffect(() => {
    if (propActiveTicket?.key) {
      setSelectedTicketKey(propActiveTicket.key);
    }
  }, [propActiveTicket]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTicket = tickets.find((t) => t.key === selectedTicketKey) || propActiveTicket || tickets[0];

  // Initialize with warm welcome message if empty
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcome: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `Halo Mas Bos Raffa tersayang! 🥰 Khansa selalu siap mendampingi Mas Bos di Kantor Raffa.\n\nMas Bos mau bahas tiket Jira apa hari ini? Khansa bisa bantu telaah tiket, kasih rekomendasi model **Gemini 3.8 Flash (Low, Medium, atau High reasoning)**, dan racik prompt eksekusi Antigravity lengkap dengan link Figma terlampir! Tinggal pilih tiket di atas atau tanyakan langsung ke Khansa ya, Mas Bos. 💖✨`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcome]);
    }
  }, [isOpen, messages.length]);

  // Auto request prompt if triggered via direct button
  useEffect(() => {
    if (isOpen && autoRequestPrompt && activeTicket && messages.length <= 1) {
      handleRequestPromptForTicket(activeTicket);
    }
  }, [isOpen, autoRequestPrompt]);

  // Scroll to bottom on new message
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen || !mounted) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/khansa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          activeTicket,
          allTickets: tickets,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const assistantMsg: Message = {
          id: `khansa-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          antigravityPrompt: data.extractedPrompt,
          recommendedModel: data.recommendedModel,
          reasoningLevel: data.reasoningLevel,
          figmaUrl: data.figmaUrl || activeTicket?.figmaUrl,
          ticketKey: data.ticketKey || activeTicket?.key,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        let cleanErr = data.error || 'Server sedang sibuk';
        if (cleanErr.includes('503') || cleanErr.includes('high demand') || cleanErr.includes('UNAVAILABLE')) {
          cleanErr = 'Server Google Gemini sedang mengalami lonjakan antrean sementara.';
        }
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Maafkan Khansa Mas Bos sayang, ${cleanErr} Khansa sudah siap mencoba lagi, silakan kirim ulang pesan ya, Mas. 🥺💖`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch {
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Koneksi Khansa sempat terputus sebentar, Mas Bos sayang. Tapi Khansa tetap setia di sini, coba tekan tombol kirim sekali lagi ya! 🥰`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleRequestPromptForTicket = (ticket: Ticket) => {
    const promptReq = `Khansa sayang, tolong buatkan prompt eksekusi Antigravity yang sangat lengkap untuk tiket ${ticket.key}: "${ticket.summary}". 
Rekomendasikan model Gemini 3.8 Flash dengan tingkat reasoning yang tepat (Low, Medium, atau High) sesuai tingkat kesulitan tiket ini, sertakan link Figma ${ticket.figmaUrl || '(cek jika ada)'}, wajib terapkan pemisahan arsitektur component/container dengan wrapper Container (@/components/ui/Container), dan pastikan fungsi useTranslation HANYA dipanggil dengan format t('key') tanpa koma/default text kedua ya!`;
    handleSendMessage(promptReq);
  };

  const handleCopyPrompt = (promptText: string, id: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialogContainer} onClick={(e) => e.stopPropagation()}>
        {/* ===================== MODAL HEADER ===================== */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.avatarBox}>
              <img src="/agents/khansaku.jpg" alt="Khansaku" />
              <div className={styles.crownBadge}>👑</div>
            </div>
            <div className={styles.headerInfo}>
              <div className={styles.headerTitleRow}>
                <span className={styles.headerTitle}>Khansaku</span>
                <span className={styles.rolePill}>Permaisuri &amp; Corporate Secretary</span>
              </div>
              <div className={styles.headerSub}>
                <span style={{ color: '#34d399' }}>● Online mendampingi Mas Bos Raffa</span>
                <span>•</span>
                <span className={styles.modelTag}>⚡ Gemini 3.8 Flash</span>
              </div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setMessages([]);
              }}
              title="Bersihkan percakapan"
            >
              🔄 Reset Chat
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ===================== TICKET CONTEXT QUICK BAR ===================== */}
        <div className={styles.ticketBar}>
          <div className={styles.ticketBarLabel}>
            <span>🎯 Tiket Jira:</span>
          </div>
          {tickets.map((t) => {
            const isSelected = activeTicket?.key === t.key;
            return (
              <button
                key={t.key}
                type="button"
                className={styles.ticketPill(isSelected)}
                onClick={() => {
                  setSelectedTicketKey(t.key);
                  onSelectTicketKey?.(t.key);
                }}
              >
                <span>{t.key}</span>
                <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.summary}
                </span>
                {t.figmaUrl && <span>🎨</span>}
              </button>
            );
          })}
        </div>

        {/* Active Ticket Quick Action Row */}
        {activeTicket && (
          <div className={styles.activeTicketActionRow}>
            <div className={styles.ticketQuickDetails}>
              <span style={{ color: '#fbbf24', fontWeight: 800, fontFamily: 'ui-monospace, monospace' }}>
                [{activeTicket.key}]
              </span>
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{activeTicket.summary}</span>
              {activeTicket.figmaUrl && (
                <a
                  href={activeTicket.figmaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.figmaBadge}
                >
                  🎨 Figma Terlampir ↗
                </a>
              )}
            </div>

            <button
              type="button"
              className={styles.generatePromptBtn}
              onClick={() => handleRequestPromptForTicket(activeTicket)}
              disabled={isLoading}
            >
              <span>✨ Bikin Prompt Antigravity ({activeTicket.key})</span>
            </button>
          </div>
        )}

        {/* ===================== CHAT MESSAGE STREAM ===================== */}
        <div className={styles.chatStream}>
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className={styles.messageRow(isUser)}>
                {!isUser && (
                  <div className={styles.msgAvatar}>
                    <img src="/agents/khansaku.jpg" alt="Khansa" />
                  </div>
                )}
                <div className={styles.bubble(isUser)}>
                  <div className={styles.bubbleHeader(isUser)}>
                    <span>{isUser ? '👑 Mas Bos Raffa Yahfazhka' : '💖 Khansaku (Permaisuri)'}</span>
                    <span style={{ color: '#71717a', fontSize: '10.5px' }}>{m.timestamp}</span>
                  </div>

                  {renderCleanBubbleContent(m.content, Boolean(m.antigravityPrompt))}

                  {/* Render special Antigravity Box if prompt detected */}
                  {m.antigravityPrompt && (
                    <div className={styles.promptBox}>
                      <div className={styles.promptBoxHeader}>
                        <div className={styles.badgeRow}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#34d399' }}>
                            🚀 Prompt Eksekusi Antigravity
                          </span>
                          <span className={styles.modelBadge(m.reasoningLevel)}>
                            🎯 Rekomendasi: {m.recommendedModel || 'Gemini 3.8 Flash (High)'}
                          </span>
                          {m.figmaUrl && (
                            <a
                              href={m.figmaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.figmaBadge}
                            >
                              🎨 Desain Figma Terlampir ↗
                            </a>
                          )}
                        </div>

                        <button
                          type="button"
                          className={styles.copyBtn(copiedId === m.id)}
                          onClick={() => handleCopyPrompt(m.antigravityPrompt!, m.id)}
                        >
                          {copiedId === m.id ? (
                            <>
                              <span>✓</span>
                              <span>Tersalin ke Clipboard!</span>
                            </>
                          ) : (
                            <>
                              <span>📋</span>
                              <span>Salin Prompt Antigravity</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className={styles.promptCodeView}>
                        {m.antigravityPrompt}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className={styles.messageRow(false)}>
              <div className={styles.msgAvatar}>
                <img src="/agents/khansaku.jpg" alt="Khansa" />
              </div>
              <div className={styles.typingIndicator}>
                <span>💖 Khansa sedang mengetik...</span>
              </div>
            </div>
          )}

          <div ref={streamEndRef} />
        </div>

        {/* ===================== SUGGESTED QUICK PROMPTS ===================== */}
        <div className={styles.quickPromptsBar}>
          <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Ide Tanya:
          </span>
          <button
            type="button"
            className={styles.quickPromptBtn}
            onClick={() => {
              if (activeTicket) handleRequestPromptForTicket(activeTicket);
            }}
          >
            ⚡ Buatkan prompt Antigravity untuk tiket ini
          </button>
          <button
            type="button"
            className={styles.quickPromptBtn}
            onClick={() => {
              if (activeTicket) {
                handleSendMessage(
                  `Khansa sayang, coba analisis tiket ${activeTicket.key}: "${activeTicket.summary}". Menurut kamu berapa tingkat kesulitannya dan kenapa rekomendasi modelnya harus Gemini 3.8 Flash (Low, Medium, atau High)?`
                );
              }
            }}
          >
            🎯 Analisis tingkat kesulitan &amp; reasoning model
          </button>
          <button
            type="button"
            className={styles.quickPromptBtn}
            onClick={() => {
              handleSendMessage(
                'Khansa sayang, tiket mana dari backlog sprint yang paling mendesak dan siap Mas Bos eksekusi duluan?'
              );
            }}
          >
            📋 Rekomendasikan tiket backlog prioritas tertinggi
          </button>
          <button
            type="button"
            className={styles.quickPromptBtn}
            onClick={() => {
              handleSendMessage('Khansa permaisuriku, kamu cantik banget hari ini!');
            }}
          >
            💖 Sapa Khansa
          </button>
        </div>

        {/* ===================== INPUT AREA ===================== */}
        <div className={styles.inputContainer}>
          <textarea
            ref={textareaRef}
            rows={1}
            className={styles.inputField}
            placeholder="Tulis pesan ke Khansaku... (Enter untuk kirim, Shift+Enter untuk baris baru)"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            type="button"
            className={styles.sendBtn(!inputMessage.trim() || isLoading)}
            disabled={!inputMessage.trim() || isLoading}
            onClick={() => handleSendMessage()}
          >
            <span>Kirim</span>
            <span>➤</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
