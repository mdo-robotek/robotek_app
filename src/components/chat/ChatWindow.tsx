"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import ForwardModal from "./ForwardModal";
import MediaPreviewModal, { type ChatMediaItem } from "./MediaPreviewModal";
import GroupInfoSidebar from "./GroupInfoSidebar";
import MessageSearchSidebar from "./MessageSearchSidebar";
import ConfirmModal from "../ConfirmModal";
import { UserGroupIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { format, isToday, isYesterday } from "date-fns";
import type { ChatMessage, ChatGroup } from "@/types/chat";
import { useChatSocket } from "@/hooks/useChatSocket";

interface ChatWindowProps {
  chatId: string;
  currentUsername: string;
  onBack?: () => void;
  onlineUsers: Set<string>;
  onPresenceUpdate?: (username: string, online: boolean) => void;
  onPresenceSync?: (online: string[]) => void;
}

interface MessagesResponse {
  messages: ChatMessage[];
  hasMore: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function getAvatarGradient(username: string) {
  const colors = ["from-teal-500 to-emerald-600", "from-green-500 to-teal-600", "from-lime-500 to-green-600"];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function ChatWindow({ chatId, currentUsername, onBack, onlineUsers, onPresenceUpdate, onPresenceSync }: ChatWindowProps) {
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const { data, mutate } = useSWR<MessagesResponse>(
    `/api/chat/messages?chatId=${chatId}&limit=100`,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  );

  const messages = data?.messages || [];

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  const mediaItems = useMemo<ChatMediaItem[]>(() => {
    return messages
      .filter((m) => (m.type === "image" || m.type === "file") && m.media_url)
      .map((m) => ({
        id: m.media_url,
        type: m.type as "image" | "file",
        label: m.text || (m.type === "image" ? "Image" : "Document"),
        messageId: m.id,
        senderId: m.sender_id,
        createdAt: m.created_at,
      }));
  }, [messages]);

  const messageById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  const isGroup = chatId.startsWith("group_");
  const { data: groupInfo, mutate: mutateGroupInfo } = useSWR<ChatGroup>(
    isGroup ? `/api/chat/groups/${chatId}` : null,
    fetcher
  );
  const { data: allUsers } = useSWR<any[]>("/api/chat/users", fetcher);
  const partnerUser = !isGroup && allUsers ? allUsers.find((u) => u.username === chatId) : null;

  const [showGroupInfo, setShowGroupInfo] = useState(false);

  useEffect(() => {
    setShowGroupInfo(false);
    setShowMessageSearch(false);
    setHighlightedMessageId(null);
  }, [chatId]);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      window.setTimeout(() => setHighlightedMessageId((current) => (current === messageId ? null : current)), 2500);
    }
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: "danger" | "info";
    confirmLabel?: string;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const handleNewMessage = useCallback(
    (msg: ChatMessage) => {
      const isRelevant =
        msg.receiver_id === chatId ||
        (msg.sender_id === chatId && msg.receiver_id === currentUsername) ||
        (msg.sender_id === currentUsername && msg.receiver_id === chatId);

      if (!isRelevant) return;

      mutate(
        (current) => {
          if (!current) return { messages: [msg], hasMore: false };
          if (current.messages.some((m) => m.id === msg.id)) return current;
          return { ...current, messages: [...current.messages, msg] };
        },
        false
      );
    },
    [chatId, currentUsername, mutate]
  );

  const handleMessageUpdated = useCallback(
    (msg: ChatMessage) => {
      mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            messages: current.messages.map((m) => (m.id === msg.id ? msg : m)),
          };
        },
        false
      );
    },
    [mutate]
  );

  const handleMessageDeleted = useCallback(
    (messageId: string) => {
      mutate(
        (current) => {
          if (!current) return current;
          return { ...current, messages: current.messages.filter((m) => m.id !== messageId) };
        },
        false
      );
    },
    [mutate]
  );

  const { connected, sendMessage, emitTypingStart, emitTypingStop, markRead, editMessage, deleteMessage, reactToMessage } =
    useChatSocket({
      currentUsername,
      chatId,
      onNewMessage: handleNewMessage,
      onMessageUpdated: handleMessageUpdated,
      onMessageDeleted: handleMessageDeleted,
      onTypingStart: (username) => {
        if (username !== currentUsername) {
          setTypingUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
        }
      },
      onTypingStop: (username) => {
        setTypingUsers((prev) => prev.filter((u) => u !== username));
      },
      onPresenceSync: onPresenceSync,
      onPresenceUpdate: onPresenceUpdate,
    });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0) {
      const hasUnread = messages.some(
        (m) => m.sender_id !== currentUsername && !(m.read_by || "").includes(currentUsername)
      );
      if (hasUnread) {
        if (connected) markRead(chatId);
        else {
          fetch("/api/chat/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ partnerId: chatId }),
          }).then((res) => {
            if (res.ok) mutate();
          });
        }
      }
    }
  }, [messages, chatId, currentUsername, mutate, connected, markRead]);

  const handleSendMessage = async (
    text: string,
    type: "text" | "image" | "file" | "audio",
    mediaUrl?: string,
    replyToId?: string
  ) => {
    if (!text.trim() && type === "text") return;
    setIsSending(true);
    setReplyTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sender_id: currentUsername,
      receiver_id: chatId,
      text,
      type,
      media_url: mediaUrl || "",
      read_by: currentUsername,
      created_at: new Date().toISOString(),
      reply_to_id: replyToId || "",
    };

    mutate(
      (current) => ({
        messages: [...(current?.messages || []), optimistic],
        hasMore: current?.hasMore || false,
      }),
      false
    );

    try {
      let saved: ChatMessage | null = null;
      if (connected) {
        saved = await sendMessage({
          chat_id: chatId,
          text,
          type,
          media_url: mediaUrl,
          reply_to_id: replyToId,
        });
      }

      if (!saved) {
        const res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, type, media_url: mediaUrl, reply_to_id: replyToId }),
        });
        if (res.ok) saved = await res.json();
      }

      if (saved) {
        mutate(
          (current) => ({
            messages: (current?.messages || []).map((m) => (m.id === tempId ? saved! : m)),
            hasMore: current?.hasMore || false,
          }),
          false
        );
      } else {
        mutate();
      }
    } catch (err) {
      console.error("Failed to send message", err);
      mutate();
    } finally {
      setIsSending(false);
    }
  };

  const handleForwardMessage = async (selectedUsernames: string[], msgToForward: ChatMessage) => {
    await Promise.all(
      selectedUsernames.map(async (username) => {
        await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: username,
            text: msgToForward.text,
            type: msgToForward.type,
            media_url: msgToForward.media_url,
            forwarded_from: msgToForward.id,
          }),
        });
      })
    );
    if (selectedUsernames.includes(chatId)) mutate();
  };

  const handleDeleteMessage = (msg: ChatMessage) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Message",
      message: "Delete this message for everyone?",
      type: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        mutate(
          (current) => ({
            messages: (current?.messages || []).filter((m) => m.id !== msg.id),
            hasMore: current?.hasMore || false,
          }),
          false
        );
        const ok = connected ? await deleteMessage(msg.id) : (
          await fetch(`/api/chat/messages?messageId=${msg.id}`, { method: "DELETE" })
        ).ok;
        if (!ok) mutate();
      },
    });
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !editText.trim()) return;
    const updated = connected
      ? await editMessage(editingMessage.id, editText)
      : (await fetch("/api/chat/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: editingMessage.id, action: "edit", text: editText }),
        }).then((r) => (r.ok ? r.json() : null)));

    if (updated) handleMessageUpdated(updated);
    setEditingMessage(null);
    setEditText("");
  };

  const handleReact = async (msg: ChatMessage, emoji: string) => {
    const updated = connected
      ? await reactToMessage(msg.id, emoji)
      : (await fetch("/api/chat/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: msg.id, action: "react", emoji }),
        }).then((r) => (r.ok ? r.json() : null)));
    if (updated) handleMessageUpdated(updated);
  };

  const displayName = isGroup ? groupInfo?.name || "Group" : chatId;
  const isPartnerOnline = !isGroup && onlineUsers.has(chatId);
  const groupMemberNames = (groupInfo?.participants || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p === currentUsername ? "You" : p))
    .join(", ");

  return (
    <div className="flex-1 flex h-full min-h-0">
      <div className="flex-1 flex flex-col min-w-0 bg-[#ECE5DD] relative">
      {/* WhatsApp chat header */}
      <div className="px-4 py-2 flex justify-between items-center bg-[#075E54] text-white shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1 rounded-full hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium overflow-hidden bg-gradient-to-br ${getAvatarGradient(displayName)}`}>
            {isGroup ? (
              <UserGroupIcon className="w-5 h-5" />
            ) : partnerUser?.image_url ? (
              <img src={partnerUser.image_url} alt={chatId} className="w-full h-full object-cover" />
            ) : (
              chatId.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[16px]">{displayName}</h3>
            </div>
            <p className="text-[14px] text-white/70 truncate max-w-[min(100%,420px)]">
              {typingUsers.length > 0
                ? `${typingUsers.join(", ")} typing...`
                : isGroup
                ? groupMemberNames || `${(groupInfo?.participants || "").split(",").filter(Boolean).length} members`
                : isPartnerOnline
                ? "online"
                : connected
                ? "offline"
                : "connecting..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setShowGroupInfo(false);
              setShowMessageSearch((open) => !open);
            }}
            className={`p-2 rounded-full hover:bg-white/10 ${showMessageSearch ? "bg-white/15" : ""}`}
            title="Search messages"
          >
            <MagnifyingGlassIcon className="w-6 h-6" />
          </button>
          {isGroup && (
            <button
              type="button"
              onClick={() => {
                setShowMessageSearch(false);
                setShowGroupInfo((open) => !open);
              }}
              className={`p-2 rounded-full hover:bg-white/10 ${showGroupInfo ? "bg-white/15" : ""}`}
              title="Group info"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingMessage && (
        <div className="absolute inset-0 z-[200] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-md shadow-xl">
            <h3 className="font-medium mb-2">Edit message</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setEditingMessage(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={handleEditMessage} className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar flex flex-col gap-0.5 relative"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cdc4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
      >
        {!data ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25D366]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.sender_id === currentUsername;
            const showTail = index === messages.length - 1 || messages[index + 1].sender_id !== msg.sender_id;
            const showDateDivider = index === 0 || !isSameDay(messages[index - 1].created_at, msg.created_at);

            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-3">
                    <span className="text-[14px] font-medium text-gray-600 bg-white/90 px-3 py-1 rounded-lg shadow-sm">
                      {getDateLabel(msg.created_at)}
                    </span>
                  </div>
                )}
                <div
                  ref={(el) => {
                    if (el) messageRefs.current.set(msg.id, el);
                    else messageRefs.current.delete(msg.id);
                  }}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <MessageBubble
                    message={msg}
                    isOwn={isOwn}
                    showTail={showTail}
                    isGroup={isGroup}
                    isHighlighted={highlightedMessageId === msg.id}
                    replyToMessage={msg.reply_to_id ? messageMap.get(msg.reply_to_id) : null}
                    onMediaClick={(media) => setActiveMediaId(media.id)}
                    onForwardClick={setForwardingMessage}
                    onDeleteClick={handleDeleteMessage}
                    onReplyClick={setReplyTo}
                    onEditClick={(m) => { setEditingMessage(m); setEditText(m.text); }}
                    onReactClick={handleReact}
                  />
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {activeMediaId && (
        <MediaPreviewModal
          items={mediaItems}
          activeId={activeMediaId}
          onClose={() => setActiveMediaId(null)}
          onSelect={setActiveMediaId}
          onForward={(messageId) => {
            const msg = messageById.get(messageId);
            if (msg) {
              setActiveMediaId(null);
              setForwardingMessage(msg);
            }
          }}
        />
      )}

      {forwardingMessage && (
        <ForwardModal message={forwardingMessage} onClose={() => setForwardingMessage(null)} onForward={handleForwardMessage} />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmLabel={confirmModal.confirmLabel}
      />

      <ChatInput
        onSendMessage={handleSendMessage}
        isSending={isSending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTypingStart={() => emitTypingStart(chatId)}
        onTypingStop={() => emitTypingStop(chatId)}
      />
      </div>

      {showMessageSearch && (
        <MessageSearchSidebar
          messages={messages}
          isGroup={isGroup}
          onClose={() => setShowMessageSearch(false)}
          onSelectMessage={scrollToMessage}
        />
      )}

      {showGroupInfo && isGroup && groupInfo && (
        <GroupInfoSidebar
          groupInfo={groupInfo}
          chatId={chatId}
          currentUsername={currentUsername}
          allUsers={allUsers || []}
          onClose={() => setShowGroupInfo(false)}
          onMutate={mutateGroupInfo}
          onConfirm={({ title, message, confirmLabel, onConfirm }) =>
            setConfirmModal({
              isOpen: true,
              title,
              message,
              type: "danger",
              confirmLabel,
              onConfirm,
            })
          }
        />
      )}
    </div>
  );
}
