"use client";

import { useMemo, useState } from "react";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { format, isToday, isYesterday } from "date-fns";
import type { ChatMessage } from "@/types/chat";

interface MessageSearchSidebarProps {
  messages: ChatMessage[];
  isGroup: boolean;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
}

function getMessageSearchText(msg: ChatMessage): string {
  if (msg.type === "text") return msg.text;
  if (msg.type === "file") return msg.text || "Document";
  if (msg.type === "image") return msg.text || "Photo";
  if (msg.type === "audio") return "Audio";
  return "";
}

function formatSearchResultDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "d/M/yyyy");
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-transparent text-[#25D366] font-semibold">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export default function MessageSearchSidebar({
  messages,
  isGroup,
  onClose,
  onSelectMessage,
}: MessageSearchSidebarProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return messages
      .filter((msg) => getMessageSearchText(msg).toLowerCase().includes(q))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [messages, query]);

  const groupedResults = useMemo(() => {
    const groups: { date: string; items: ChatMessage[] }[] = [];
    results.forEach((msg) => {
      const date = formatSearchResultDate(msg.created_at);
      const last = groups[groups.length - 1];
      if (last?.date === date) last.items.push(msg);
      else groups.push({ date, items: [msg] });
    });
    return groups;
  }, [results]);

  return (
    <aside className="w-full sm:w-[360px] shrink-0 flex flex-col h-full bg-white border-l border-gray-200 shadow-xl z-40">
      <div className="px-4 py-3 bg-[#075E54] text-white flex items-center gap-3 shrink-0">
        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-[17px] font-normal">Search messages</h2>
      </div>

      <div className="px-3 py-3 bg-[#F0F2F5] shrink-0 border-b border-gray-200">
        <div className="relative flex items-center">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white rounded-lg pl-9 pr-9 py-2 text-sm text-gray-800 placeholder-gray-500 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 p-1 rounded-full text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!query.trim() ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Search for messages with your contact{isGroup ? "s" : ""}.
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No messages found for &ldquo;{query}&rdquo;
          </div>
        ) : (
          groupedResults.map((group) => (
            <div key={group.date}>
              <p className="px-4 py-2 text-[14px] text-gray-500 bg-[#F0F2F5] sticky top-0">{group.date}</p>
              {group.items.map((msg) => {
                const text = getMessageSearchText(msg);
                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => onSelectMessage(msg.id)}
                    className="w-full text-left px-4 py-3 hover:bg-[#F5F6F6] border-b border-gray-100 transition-colors"
                  >
                    {isGroup && (
                      <p className="text-sm font-medium text-[#25D366] mb-0.5 truncate">{msg.sender_id}</p>
                    )}
                    <p className="text-sm text-gray-700 leading-snug">
                      {highlightText(truncate(text), query)}
                    </p>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
