"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

interface User {
  id: string;
  username: string;
  image_url: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function getAvatarGradient(username: string) {
  const colors = [
    "from-teal-500 to-emerald-600",
    "from-green-500 to-teal-600",
    "from-lime-500 to-green-600",
    "from-cyan-500 to-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface CreateGroupPanelProps {
  currentUsername: string;
  onClose: () => void;
  onGroupCreated: (group: { id: string }) => void;
}

export default function CreateGroupPanel({
  currentUsername,
  onClose,
  onGroupCreated,
}: CreateGroupPanelProps) {
  const [step, setStep] = useState<"members" | "details">("members");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: users } = useSWR<User[]>("/api/chat/users", fetcher);

  const filteredUsers = useMemo(() => {
    return (users || [])
      .filter((u) => u.username !== currentUsername)
      .filter((u) => u.username.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [users, currentUsername, searchTerm]);

  const groupedUsers = useMemo(() => {
    const groups: Record<string, User[]> = {};
    filteredUsers.forEach((user) => {
      const letter = user.username.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(user);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredUsers]);

  const toggleUser = (username: string) => {
    setSelectedUsers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const allParticipants = [currentUsername, ...selectedUsers];

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length < 1) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/chat/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          participants: allParticipants.join(","),
          creator: currentUsername,
        }),
      });

      if (res.ok) {
        const newGroup = await res.json();
        onGroupCreated(newGroup);
      }
    } catch (error) {
      console.error("Create Group Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "details") {
    return (
      <div className="flex flex-col h-full bg-white relative">
        <div className="px-3 py-3 bg-[#075E54] text-white flex items-center gap-4 shrink-0">
          <button onClick={() => setStep("members")} className="p-1 hover:bg-white/10 rounded-full">
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <h2 className="text-[19px] font-normal">New group</h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#F0F2F5] flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#5B6472]" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Group subject (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full max-w-xs text-center border-b-2 border-[#25D366] pb-2 text-lg text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
              autoFocus
            />
          </div>

          <p className="text-[14px] text-[#25D366] font-medium tracking-wide mb-3">
            Participants: {allParticipants.length}
          </p>
          <div className="space-y-1">
            {allParticipants.map((username) => (
              <div key={username} className="flex items-center gap-3 py-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium bg-gradient-to-br ${getAvatarGradient(username)}`}
                >
                  {username.charAt(0).toUpperCase()}
                </div>
                <span className="text-[17px] text-gray-900">
                  {username}
                  {username === currentUsername && (
                    <span className="text-gray-500 text-sm ml-1">(You)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 right-6">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSubmitting || !groupName.trim()}
            className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:bg-[#20bd5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Create group"
          >
            <CheckIcon className="w-7 h-7" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="px-3 py-3 bg-[#075E54] text-white flex items-center gap-4 shrink-0">
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-[19px] font-normal leading-tight">Add group members</h2>
          {selectedUsers.length > 0 && (
            <p className="text-[14px] text-white/70">{selectedUsers.length} selected</p>
          )}
        </div>
      </div>

      <div className="px-3 py-2 bg-[#F0F2F5] shrink-0">
        <div className="relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search name or number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 placeholder-gray-500 focus:outline-none"
          />
        </div>
      </div>

      {selectedUsers.length > 0 && (
        <div className="flex gap-2 px-3 py-2 overflow-x-auto custom-scrollbar shrink-0 border-b border-gray-100">
          {selectedUsers.map((username) => (
            <button
              key={username}
              type="button"
              onClick={() => toggleUser(username)}
              className="relative shrink-0"
              title={`Remove ${username}`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-medium bg-gradient-to-br ${getAvatarGradient(username)}`}
              >
                {username.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center">
                <XMarkIcon className="w-3 h-3 text-white" />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {groupedUsers.length === 0 ? (
          <div className="text-center py-8 text-[#5B6472] text-sm">No contacts found.</div>
        ) : (
          groupedUsers.map(([letter, letterUsers]) => (
            <div key={letter}>
              <div className="px-4 py-1.5 bg-[#F0F2F5] sticky top-0">
                <span className="text-[14px] font-medium text-[#25D366]">{letter}</span>
              </div>
              {letterUsers.map((user) => {
                const isSelected = selectedUsers.includes(user.username);
                return (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => toggleUser(user.username)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F5F6F6] transition-colors"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium overflow-hidden bg-gradient-to-br ${getAvatarGradient(user.username)} shrink-0`}
                    >
                      {user.image_url ? (
                        <img src={user.image_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="flex-1 text-left text-[17px] text-gray-900 truncate">{user.username}</span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-[#25D366] border-[#25D366]" : "border-gray-300"
                      }`}
                    >
                      {isSelected && <CheckIcon className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {selectedUsers.length > 0 && (
        <div className="absolute bottom-6 right-6">
          <button
            type="button"
            onClick={() => setStep("details")}
            className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:bg-[#20bd5a] transition-colors"
            title="Next"
          >
            <ArrowRightIcon className="w-7 h-7" />
          </button>
        </div>
      )}
    </div>
  );
}
