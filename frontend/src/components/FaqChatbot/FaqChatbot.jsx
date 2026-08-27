// src/components/FaqChatbot/FaqChatbot.jsx
//
// Self-contained FAQ chatbot widget for the Hub (home) page only.
//
// Design constraints, deliberately kept simple and safe:
//   - No backend route, no new API call, no external AI key.
//   - All Q&A data lives in ./faqData.js and is searched entirely in-browser.
//   - This file is not imported by any other page, so it cannot affect the
//     complaint system, scheme checker, or price checker.
//   - Rendered as a fixed floating widget — it overlays the page, it does not
//     alter any existing layout/markup on Hub.jsx beyond one mount point.

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, MessageCircle } from 'lucide-react';
import { FAQ_CATEGORIES, FAQ_DATA } from './faqData';

// Only the 4 top-level topics are offered as quick-pick pills (matches the
// requested design). "Account & Login" content is still fully searchable
// via free-text typing — it's just not one of the front-and-center pills.
const QUICK_CATEGORIES = FAQ_CATEGORIES.filter((c) => c.id !== 'account');

const GREETING_TEXT =
  "Hi! I'm the Smart Village Help Assistant. Ask me anything about reporting issues, checking scheme eligibility, or market prices — or pick a topic below.";

function matchesQuery(entry, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [entry.question, entry.answer, ...(entry.keywords || [])]
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// A single chip that a bot message can attach — clicking it drives the conversation.
function Chip({ label, onClick, wide }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${
        wide ? 'w-full text-left' : ''
      } border border-primary-300 bg-white dark:bg-gray-800 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-full px-4 py-2 text-sm font-medium transition-colors`}
    >
      {label}
    </button>
  );
}

export default function FaqChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef(null);

  // Seed the greeting the first time the widget is opened.
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: makeId(),
          sender: 'bot',
          text: GREETING_TEXT,
          chips: QUICK_CATEGORIES.map((cat) => ({
            label: `${cat.emoji} ${cat.label}`,
            categoryId: cat.id,
          })),
          chipLayout: 'grid',
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const pushMessage = (msg) => {
    setMessages((prev) => [...prev, { id: makeId(), ...msg }]);
  };

  const backToTopicsChip = {
    label: '🏠 Back to topics',
    onSelect: () => {
      pushMessage({
        sender: 'bot',
        text: 'Sure — what would you like to know about?',
        chips: QUICK_CATEGORIES.map((cat) => ({
          label: `${cat.emoji} ${cat.label}`,
          categoryId: cat.id,
        })),
        chipLayout: 'grid',
      });
    },
  };

  const handleSelectFaq = (entry, labelOverride) => {
    pushMessage({ sender: 'user', text: labelOverride || entry.question });
    pushMessage({
      sender: 'bot',
      text: entry.answer,
      chips: [backToTopicsChip],
      chipLayout: 'list',
    });
  };

  const handleSelectCategory = (categoryId) => {
    const cat = FAQ_CATEGORIES.find((c) => c.id === categoryId);
    pushMessage({ sender: 'user', text: `${cat.emoji} ${cat.label}` });

    const questions = FAQ_DATA.filter((entry) => entry.category === categoryId);
    pushMessage({
      sender: 'bot',
      text: `Here are some common questions about ${cat.label}:`,
      chips: questions.map((q) => ({ label: q.question, onSelect: () => handleSelectFaq(q) })),
      chipLayout: 'list',
    });
  };

  const handleChipClick = (chip) => {
    if (chip.categoryId) {
      handleSelectCategory(chip.categoryId);
    } else if (chip.onSelect) {
      chip.onSelect();
    }
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;

    pushMessage({ sender: 'user', text });
    setInputValue('');

    const matches = FAQ_DATA.filter((entry) => matchesQuery(entry, text)).slice(0, 5);

    if (matches.length === 0) {
      pushMessage({
        sender: 'bot',
        text:
          "I couldn't find an exact answer for that. Try rephrasing, or pick a topic below and I'll show you related questions.",
        chips: QUICK_CATEGORIES.map((cat) => ({
          label: `${cat.emoji} ${cat.label}`,
          categoryId: cat.id,
        })),
        chipLayout: 'grid',
      });
    } else if (matches.length === 1) {
      pushMessage({
        sender: 'bot',
        text: matches[0].answer,
        chips: [backToTopicsChip],
        chipLayout: 'list',
      });
    } else {
      pushMessage({
        sender: 'bot',
        text: 'I found a few things that might help — tap one:',
        chips: matches.map((q) => ({ label: q.question, onSelect: () => handleSelectFaq(q) })),
        chipLayout: 'list',
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggle = () => setOpen((prev) => !prev);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Panel */}
      {open && (
        <div className="mb-4 w-[420px] max-w-[92vw] h-[600px] max-h-[80vh] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-primary-600 text-white px-6 py-5 flex items-center gap-3">
            <Sparkles size={22} />
            <div>
              <p className="text-base font-bold leading-tight">Smart Village Help</p>
              <p className="text-xs text-white/85 leading-tight mt-0.5">Ask about any feature</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                {msg.sender === 'bot' ? (
                  <div className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed max-w-[90%] whitespace-pre-line">
                    {msg.text}
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div className="bg-primary-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed max-w-[90%]">
                      {msg.text}
                    </div>
                  </div>
                )}

                {msg.chips && msg.chips.length > 0 && (
                  <div
                    className={`mt-3 ${
                      msg.chipLayout === 'grid'
                        ? 'grid grid-cols-2 gap-2'
                        : 'flex flex-col items-start gap-2'
                    }`}
                  >
                    {msg.chips.map((chip, i) => (
                      <Chip
                        key={i}
                        label={chip.label}
                        wide={msg.chipLayout === 'list'}
                        onClick={() => handleChipClick(chip)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="border-t border-gray-100 dark:border-gray-700 p-4 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              className="flex-1 px-4 py-3 text-sm rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              type="button"
              onClick={handleSend}
              className="w-11 h-11 shrink-0 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition-colors"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-16 h-16 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105"
        aria-label={open ? 'Close village assistant chat' : 'Open village assistant chat'}
      >
        {open ? <X size={26} /> : <MessageCircle size={26} />}
      </button>
    </div>
  );
}