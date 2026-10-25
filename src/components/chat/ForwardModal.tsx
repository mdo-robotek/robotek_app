"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { XMarkIcon, MagnifyingGlassIcon, PaperAirplaneIcon, ArrowUturnRightIcon } from "@heroicons/react/24/outline";
import type { ChatMessage } from "@/types/chat";

interface ForwardModalProps {
  message: ChatMessage;
  onClose: () => void;
  onForward: (selectedUsernames: string[], message: ChatMessage) => Promise<void>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ForwardModal({ message, onClose, onForward }: ForwardModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Use the same endpoint as ChatSidebar
  const { data: users, error } = useSWR<any[]>(`/api/chat/users`, fetcher);

  const filteredUsers = users?.filter(
    (u) => 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (u.role_name && u.role_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleUser = (username: string) => {
    setSelectedUsers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleForward = async () => {
    if (selectedUsers.length === 0) return;
    setIsSending(true);
    try {
      await onForward(selectedUsers, message);
      onClose();
    } catch (error) {
      console.error("Failed to forward:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2 text-gray-800">
            <ArrowUturnRightIcon className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-lg">Forward Message</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#5B6472] hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472]" />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100/50 border border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none transition-all"
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {!users && !error ? (
            <div className="p-8 flex justify-center">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredUsers?.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No contacts found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers?.map((user) => (
                <label 
                  key={user.id} 
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.includes(user.username)}
                      onChange={() => toggleUser(user.username)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{user.username}</p>
                    {user.role_name && (
                      <p className="text-[14px] text-gray-500 truncate">{user.role_name}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-500 font-medium">
            {selectedUsers.length} selected
          </div>
          <button 
            onClick={handleForward}
            disabled={selectedUsers.length === 0 || isSending}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 active:scale-95"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                Sending...
              </span>
            ) : (
              <>
                <PaperAirplaneIcon className="w-5 h-5 -rotate-45" />
                <span>Forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
