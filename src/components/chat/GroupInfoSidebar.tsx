"use client";

import { useMemo, useState } from "react";
import {
  XMarkIcon,
  UserGroupIcon,
  PencilIcon,
  CheckIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import type { ChatGroup } from "@/types/chat";

interface GroupInfoSidebarProps {
  groupInfo: ChatGroup;
  chatId: string;
  currentUsername: string;
  allUsers: { username: string; image_url?: string }[];
  onClose: () => void;
  onMutate: () => void;
  onConfirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }) => void;
}

function getAvatarGradient(name: string) {
  const colors = [
    "from-teal-500 to-emerald-600",
    "from-green-500 to-teal-600",
    "from-lime-500 to-green-600",
    "from-cyan-500 to-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function UserAvatar({
  username,
  imageUrl,
  size = "md",
}: {
  username: string;
  imageUrl?: string;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-medium overflow-hidden bg-gradient-to-br shrink-0 ${getAvatarGradient(username)}`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={username} className="w-full h-full object-cover" />
      ) : (
        username.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export default function GroupInfoSidebar({
  groupInfo,
  chatId,
  currentUsername,
  allUsers,
  onClose,
  onMutate,
  onConfirm,
}: GroupInfoSidebarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(groupInfo.name);
  const [memberSearch, setMemberSearch] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const admins = (groupInfo.admins || "").split(",").map((a) => a.trim()).filter(Boolean);
  const participants = (groupInfo.participants || "").split(",").map((p) => p.trim()).filter(Boolean);
  const participantSet = useMemo(() => new Set(participants), [participants]);
  const currentUserIsAdmin = admins.includes(currentUsername);

  const filteredParticipants = participants.filter((username) =>
    username.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const contactsForAdd = useMemo(() => {
    return allUsers
      .filter((u) => u.username !== currentUsername)
      .filter((u) => u.username.toLowerCase().includes(addSearch.toLowerCase()))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [allUsers, currentUsername, addSearch]);

  const saveGroupName = async () => {
    const name = editedName.trim();
    if (!name || name === groupInfo.name) {
      setIsEditingName(false);
      setEditedName(groupInfo.name);
      return;
    }
    setIsUpdating(true);
    await fetch(`/api/chat/groups/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    onMutate();
    setIsEditingName(false);
    setIsUpdating(false);
  };

  const handleRemoveMember = (username: string) => {
    onConfirm({
      title: "Remove member",
      message: `Remove ${username} from this group?`,
      confirmLabel: "Remove",
      onConfirm: async () => {
        const newParticipants = participants.filter((p) => p !== username).join(",");
        const newAdmins = admins.filter((a) => a !== username).join(",");
        await fetch(`/api/chat/groups/${chatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participants: newParticipants, admins: newAdmins }),
        });
        onMutate();
      },
    });
  };

  const toggleAddUser = (username: string) => {
    if (participantSet.has(username)) return;
    setSelectedToAdd((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setIsUpdating(true);
    const updated = [...participants, ...selectedToAdd].join(",");
    await fetch(`/api/chat/groups/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participants: updated }),
    });
    setSelectedToAdd([]);
    setAddSearch("");
    setShowAddMembers(false);
    onMutate();
    setIsUpdating(false);
  };

  const closeAddMembers = () => {
    setShowAddMembers(false);
    setSelectedToAdd([]);
    setAddSearch("");
  };

  if (showAddMembers) {
    return (
      <aside className="w-full sm:w-[360px] shrink-0 flex flex-col h-full bg-white border-l border-gray-200 shadow-xl z-40 relative">
        <div className="px-4 py-3 bg-[#075E54] text-white flex items-center gap-3 shrink-0">
          <button type="button" onClick={closeAddMembers} className="p-1 rounded-full hover:bg-white/10">
            <XMarkIcon className="w-6 h-6" />
          </button>
          <h2 className="text-[17px] font-normal">Add member</h2>
        </div>

        <div className="px-3 py-2 bg-[#F0F2F5] shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search name or number"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="w-full bg-white rounded-lg pl-9 pr-4 py-2 text-sm text-gray-800 placeholder-gray-500 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {selectedToAdd.length > 0 && (
          <div className="flex gap-2 px-3 py-2 overflow-x-auto custom-scrollbar shrink-0 border-b border-gray-100">
            {selectedToAdd.map((username) => {
              const userMeta = allUsers.find((u) => u.username === username);
              return (
                <button
                  key={username}
                  type="button"
                  onClick={() => toggleAddUser(username)}
                  className="relative shrink-0"
                  title={`Remove ${username}`}
                >
                  <UserAvatar username={username} imageUrl={userMeta?.image_url} size="lg" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center">
                    <XMarkIcon className="w-3 h-3 text-white" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <p className="px-4 py-2 text-[14px] text-[#25D366] font-medium">Contacts</p>
          {contactsForAdd.length === 0 ? (
            <div className="text-center py-8 text-[#5B6472] text-sm">No contacts found.</div>
          ) : (
            contactsForAdd.map((user) => {
              const alreadyAdded = participantSet.has(user.username);
              const isSelected = selectedToAdd.includes(user.username);
              return (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => toggleAddUser(user.username)}
                  disabled={alreadyAdded}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    alreadyAdded ? "opacity-60 cursor-default" : "hover:bg-[#F5F6F6]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      alreadyAdded
                        ? "bg-gray-300 border-gray-300"
                        : isSelected
                        ? "bg-[#25D366] border-[#25D366]"
                        : "border-gray-300"
                    }`}
                  >
                    {(alreadyAdded || isSelected) && (
                      <CheckIcon className={`w-3 h-3 stroke-[3] ${alreadyAdded ? "text-gray-500" : "text-white"}`} />
                    )}
                  </div>
                  <UserAvatar username={user.username} imageUrl={user.image_url} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-gray-900 truncate">{user.username}</p>
                    {alreadyAdded && (
                      <p className="text-[14px] text-gray-500">Already added to group</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selectedToAdd.length > 0 && (
          <div className="absolute bottom-6 right-6">
            <button
              type="button"
              onClick={handleAddMembers}
              disabled={isUpdating}
              className="w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:bg-[#20bd5a] disabled:opacity-50 transition-colors"
              title="Add to group"
            >
              <CheckIcon className="w-7 h-7" />
            </button>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-full sm:w-[360px] shrink-0 flex flex-col h-full bg-white border-l border-gray-200 shadow-xl z-40">
      <div className="px-4 py-3 bg-[#075E54] text-white flex items-center gap-3 shrink-0">
        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-[17px] font-normal">Group info</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col items-center px-6 py-8 bg-[#F0F2F5] border-b border-gray-200">
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center text-white mb-4 bg-gradient-to-br ${getAvatarGradient(groupInfo.name)}`}
          >
            <UserGroupIcon className="w-14 h-14" />
          </div>

          {isEditingName && currentUserIsAdmin ? (
            <div className="w-full max-w-xs flex items-center gap-2">
              <input
                autoFocus
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveGroupName();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    setEditedName(groupInfo.name);
                  }
                }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#25D366]"
              />
              <button
                type="button"
                onClick={saveGroupName}
                disabled={isUpdating}
                className="p-2 rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] disabled:opacity-50"
              >
                <CheckIcon className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 max-w-full">
              <h3 className="text-xl text-gray-900 font-normal text-center truncate">{groupInfo.name}</h3>
              {currentUserIsAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setEditedName(groupInfo.name);
                    setIsEditingName(true);
                  }}
                  className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 shrink-0"
                  title="Edit group name"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <p className="text-sm text-gray-500 mt-2">Group · {participants.length} members</p>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#25D366] font-medium">{participants.length} members</p>
          </div>

          {currentUserIsAdmin && (
            <button
              type="button"
              onClick={() => setShowAddMembers(true)}
              className="w-full flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-[#F5F6F6] transition-colors mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <UserPlusIcon className="w-5 h-5 text-[#25D366]" />
              </div>
              <span className="text-[15px] text-gray-900">Add member</span>
            </button>
          )}

          <div className="relative mb-3">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
            <input
              type="text"
              placeholder="Search members"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full bg-[#F0F2F5] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:outline-none"
            />
          </div>

          <div className="space-y-0.5">
            {filteredParticipants.map((username) => {
              const isAdmin = admins.includes(username);
              const userMeta = allUsers.find((u) => u.username === username);
              return (
                <div
                  key={username}
                  className="flex items-center justify-between py-2.5 px-1 rounded-lg hover:bg-[#F5F6F6]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar username={username} imageUrl={userMeta?.image_url} />
                    <div className="min-w-0">
                      <p className="text-[15px] text-gray-900 truncate">
                        {username}
                        {username === currentUsername && (
                          <span className="text-gray-500 text-sm ml-1">(You)</span>
                        )}
                      </p>
                      {isAdmin && (
                        <span className="text-[14px] text-[#25D366] font-medium">Group admin</span>
                      )}
                    </div>
                  </div>
                  {currentUserIsAdmin && username !== currentUsername && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(username)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full shrink-0"
                      title="Remove from group"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
