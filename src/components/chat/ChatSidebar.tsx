"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChatBubbleLeftEllipsisIcon, MagnifyingGlassIcon, UsersIcon, PlusIcon } from "@heroicons/react/24/outline";
import CreateGroupPanel from "./CreateGroupPanel";
import { formatSidebarChatTime } from "@/lib/chat-time";

interface User {
  id: string;
  username: string;
  image_url: string;
  role_name: string;
  lastMessage?: {
    text: string;
    type: "text" | "image" | "file" | "audio";
    sender_id: string;
    read_by: string;
    created_at: string;
  } | null;
  unreadCount: number;
}

interface Group {
  id: string;
  name: string;
  participants: string;
  admins: string;
  lastMessage?: {
    text: string;
    type: "text" | "image" | "file" | "audio";
    sender_id: string;
    read_by: string;
    created_at: string;
  } | null;
  unreadCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getAvatarGradient(username: string) {
  const colors = [
    "from-teal-500 to-emerald-600",
    "from-green-500 to-teal-600",
    "from-lime-500 to-green-600",
    "from-cyan-500 to-teal-600",
    "from-emerald-500 to-green-600",
    "from-teal-600 to-cyan-600",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatChatTime(dateStr: string): string {
  return formatSidebarChatTime(dateStr);
}

interface ChatSidebarProps {
  currentUsername: string;
  activeChatId: string | null;
  onSelectChat: (username: string) => void;
  onlineUsers: Set<string>;
}

export default function ChatSidebar({ currentUsername, activeChatId, onSelectChat, onlineUsers }: ChatSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const { data: contacts } = useSWR<User[]>("/api/chat/users", fetcher, { refreshInterval: 120000 });
  const { data: groups, mutate: mutateGroups } = useSWR<Group[]>(
    `/api/chat/groups?username=${currentUsername}`,
    fetcher,
    { refreshInterval: 120000 }
  );

  const allChats = [
    ...(contacts?.map((c) => ({ ...c, isGroup: false })) || []),
    ...(groups?.map((g) => ({ ...g, isGroup: true, username: g.id })) || []),
  ]
    .filter((chat) => {
      const nameToMatch = chat.isGroup ? (chat as Group & { isGroup: true }).name : chat.username;
      return nameToMatch.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div className="w-full md:w-[400px] flex flex-col h-full bg-white border-r border-gray-200 relative">
      {isCreatingGroup ? (
        <CreateGroupPanel
          currentUsername={currentUsername}
          onClose={() => setIsCreatingGroup(false)}
          onGroupCreated={(group) => {
            mutateGroups();
            setIsCreatingGroup(false);
            onSelectChat(group.id);
          }}
        />
      ) : (
        <>
      {/* WhatsApp header */}
      <div className="px-4 py-3 bg-[#075E54] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${getAvatarGradient(currentUsername)}`}>
            {currentUsername.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-[15px]">Chats</span>
        </div>
        <button
          onClick={() => setIsCreatingGroup(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          title="New group"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-[#F0F2F5]">
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 placeholder-gray-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {(!contacts || !groups) ? (
          <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Loading chats...</div>
        ) : allChats.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No conversations found.</div>
        ) : (
          allChats.map((chat) => {
            const isActive = activeChatId === (chat.isGroup ? chat.id : chat.username);

            if (chat.isGroup) {
              const group = chat as Group & { isGroup: true };
              return (
                <button
                  key={`group-${group.id}`}
                  onClick={() => onSelectChat(group.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#F5F6F6] transition-colors border-b border-gray-100 ${
                    isActive ? "bg-[#F0F2F5]" : ""
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white bg-gradient-to-br ${getAvatarGradient(group.name)} shrink-0`}>
                    <UsersIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-medium text-[17px] text-gray-900 truncate">{group.name}</h3>
                      {group.lastMessage && (
                        <span className="text-[14px] text-gray-500 shrink-0 ml-2">
                          {formatChatTime(group.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-sm text-gray-500 truncate">
                        {group.lastMessage
                          ? group.lastMessage.type === "text"
                            ? group.lastMessage.text
                            : `[${group.lastMessage.type}]`
                          : `${(group.participants || "").split(",").filter(Boolean).length} members`}
                      </p>
                      {group.unreadCount > 0 && (
                        <span className="bg-[#25D366] text-white text-[14px] font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0">
                          {group.unreadCount > 99 ? "99+" : group.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            }

            const user = chat as User & { isGroup: false };
            const isOnline = onlineUsers.has(user.username);

            return (
              <button
                key={`user-${user.username}`}
                onClick={() => onSelectChat(user.username)}
                className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#F5F6F6] transition-colors border-b border-gray-100 ${
                  isActive ? "bg-[#F0F2F5]" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg overflow-hidden bg-gradient-to-br ${getAvatarGradient(user.username)}`}>
                    {user.image_url ? (
                      <img src={user.image_url} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-medium text-[17px] text-gray-900 truncate">{user.username}</h3>
                    {user.lastMessage && (
                      <span className={`text-[14px] shrink-0 ml-2 ${user.unreadCount > 0 ? "text-[#25D366] font-medium" : "text-gray-500"}`}>
                        {formatChatTime(user.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      {user.lastMessage?.sender_id === currentUsername && (
                        <ReadTicks read={user.lastMessage.read_by?.includes(user.username)} />
                      )}
                      <p className={`text-sm truncate ${user.unreadCount > 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                        {user.lastMessage
                          ? user.lastMessage.type === "text"
                            ? user.lastMessage.text
                            : `[${user.lastMessage.type}]`
                          : user.role_name || "Tap to chat"}
                      </p>
                    </div>
                    {user.unreadCount > 0 && (
                      <span className="bg-[#25D366] text-white text-[14px] font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0 ml-2">
                        {user.unreadCount > 99 ? "99+" : user.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
        </>
      )}
    </div>
  );
}

function ReadTicks({ read }: { read?: boolean }) {
  if (read) {
    return (
      <span className="flex shrink-0">
        <svg viewBox="0 0 16 15" className="w-4 h-3 text-[#53BDEB]" fill="currentColor">
          <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
        </svg>
      </span>
    );
  }
  return (
    <svg viewBox="0 0 16 15" className="w-4 h-3 text-gray-400 shrink-0" fill="currentColor">
      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
    </svg>
  );
}
