import { useRef, useState } from "react";
import { formatMessageTime } from "@/lib/chat-time";
import { getDriveImageUrl } from "@/lib/drive-utils";
import { PlayIcon, PauseIcon, MicrophoneIcon } from "@heroicons/react/24/solid";
import { DocumentIcon } from "@heroicons/react/24/outline";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showTail?: boolean;
  isGroup?: boolean;
  replyToMessage?: ChatMessage | null;
  onMediaClick?: (media: { id: string; type: "image" | "file"; label: string }) => void;
  onForwardClick?: (message: ChatMessage) => void;
  onDeleteClick?: (message: ChatMessage) => void;
  onReplyClick?: (message: ChatMessage) => void;
  onEditClick?: (message: ChatMessage) => void;
  onReactClick?: (message: ChatMessage, emoji: string) => void;
  isHighlighted?: boolean;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const isEmojiOnly = (text: string) => {
  if (!text) return false;
  const stripped = text.replace(/[\s\n]/g, "");
  if (stripped.length === 0) return false;
  return /^[\p{Emoji}\u200d\ufe0f]+$/u.test(stripped);
};

function parseReactions(reactions?: string): Record<string, string[]> {
  if (!reactions) return {};
  try {
    return JSON.parse(reactions);
  } catch {
    return {};
  }
}

export default function MessageBubble({
  message,
  isOwn,
  showTail = true,
  isGroup = false,
  replyToMessage,
  onMediaClick,
  onForwardClick,
  onDeleteClick,
  onReplyClick,
  onEditClick,
  onReactClick,
  isHighlighted = false,
}: MessageBubbleProps) {
  const emojisOnly = message.type === "text" && isEmojiOnly(message.text);
  const isRead = isOwn && !isGroup && (message.read_by || "").split(",").map((s) => s.trim()).includes(message.receiver_id);
  const isGroupRead = isOwn && isGroup && (message.read_by || "").split(",").map((s) => s.trim()).filter(Boolean).length > 1;

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const reactions = parseReactions(message.reactions);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(console.error);
      setIsPlaying(!isPlaying);
    }
  };

  const formatAudioTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    return `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex flex-col max-w-[75%] ${isOwn ? "self-end items-end" : "self-start items-start"} mb-0.5`}
    >
      {!isOwn && isGroup && showTail && (
        <span className="text-[14px] font-medium text-[#25D366] mb-0.5 ml-1">{message.sender_id}</span>
      )}

      <div
        className={`flex items-center ${isOwn ? "flex-row-reverse" : "flex-row"}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
      <div
        className={`relative leading-relaxed break-words shadow-sm transition-all duration-500 ${
          isHighlighted ? "ring-2 ring-[#25D366] ring-offset-2 rounded-lg" : ""
        } ${
          emojisOnly
            ? "text-[3rem] p-0"
            : `text-[14.2px] px-2 py-1.5 ${
                isOwn
                  ? `bg-[#DCF8C6] text-gray-900 rounded-lg ${showTail ? "rounded-tr-none" : ""}`
                  : `bg-white text-gray-900 rounded-lg ${showTail ? "rounded-tl-none" : ""}`
              }`
        }`}
      >
        {/* Reply preview */}
        {message.reply_to_id && replyToMessage && (
          <div
            className={`border-l-4 border-[#25D366] pl-2 mb-1 py-0.5 rounded-sm ${
              isOwn ? "bg-[#c8e6b0]" : "bg-gray-50"
            }`}
          >
            <p className="text-[14px] font-medium text-[#25D366]">{replyToMessage.sender_id}</p>
            <p className="text-[14px] text-gray-600 truncate">
              {replyToMessage.type === "text" ? replyToMessage.text : `[${replyToMessage.type}]`}
            </p>
          </div>
        )}

        {message.type === "text" && <p className="whitespace-pre-wrap">{message.text}</p>}

        {message.type === "image" && message.media_url && (
          <img
            src={getDriveImageUrl(message.media_url)}
            alt="Media"
            className="max-w-[280px] rounded-md cursor-pointer mt-0.5 hover:opacity-90 transition-opacity"
            onClick={() =>
              onMediaClick?.({
                id: message.media_url,
                type: "image",
                label: message.text || "Image",
              })
            }
          />
        )}

        {message.type === "file" && message.media_url && (
          <button
            type="button"
            onClick={() =>
              onMediaClick?.({
                id: message.media_url,
                type: "file",
                label: message.text || "Document",
              })
            }
            className={`flex items-center gap-3 mt-0.5 p-2 rounded-lg max-w-[280px] text-left transition-opacity hover:opacity-90 ${
              isOwn ? "bg-[#c8e6b0]/80" : "bg-gray-50"
            }`}
          >
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <DocumentIcon className={`w-7 h-7 ${isOwn ? "text-red-700" : "text-red-500"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {message.text || "Document"}
              </p>
              <p className="text-[14px] text-gray-500 mt-0.5">
                {(message.text || "").split(".").pop()?.toUpperCase() || "FILE"} · Tap to preview
              </p>
            </div>
          </button>
        )}

        {message.type === "audio" && message.media_url && (
          <div className="flex items-center gap-2 min-w-[200px] p-1">
            <audio
              ref={audioRef}
              src={`/api/audio/${message.media_url}`}
              onTimeUpdate={() => {
                if (audioRef.current) {
                  setAudioCurrentTime(audioRef.current.currentTime);
                  if (audioRef.current.duration) {
                    setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                  }
                }
              }}
              onLoadedMetadata={() => audioRef.current && setAudioDuration(audioRef.current.duration)}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0">
              {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max="100"
                value={audioProgress}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setAudioProgress(v);
                  if (audioRef.current?.duration) {
                    audioRef.current.currentTime = (v / 100) * audioRef.current.duration;
                  }
                }}
                className="w-full h-1 accent-[#25D366]"
              />
              <div className="flex justify-between text-[13px] text-gray-500">
                <span>{formatAudioTime(audioCurrentTime)}</span>
                <MicrophoneIcon className="w-3 h-3" />
                <span>{formatAudioTime(audioDuration)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-start" : "justify-end"}`}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReactClick?.(message, emoji)}
                className="text-[14px] bg-white rounded-full px-1.5 py-0.5 shadow border border-gray-100"
              >
                {emoji} {users.length > 1 && <span className="text-gray-500">{users.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Time + ticks */}
        <div className={`flex items-center justify-end gap-1 mt-0.5 ${emojisOnly ? "bg-white/80 rounded px-1" : ""}`}>
          {message.edited_at && <span className="text-[13px] text-gray-500 italic">edited</span>}
          <span className="text-[14px] text-gray-500">{formatMessageTime(message.created_at)}</span>
          {isOwn && (
            <ReadTicks read={isGroup ? isGroupRead : isRead} />
          )}
        </div>
      </div>

        {/* Action bar — right side of message */}
        {showActions && (
          <>
            <div className="w-1 self-stretch min-h-[28px] shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-0.5 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 shrink-0 z-30">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onReactClick?.(message, emoji);
                    setShowActions(false);
                  }}
                  className="text-base hover:scale-125 transition-transform p-1 rounded hover:bg-gray-100"
                >
                  {emoji}
                </button>
              ))}
              <span className="w-px h-5 bg-gray-200 mx-0.5" />
              {onReplyClick && (
                <button
                  type="button"
                  onClick={() => { onReplyClick(message); setShowActions(false); }}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
                  title="Reply"
                >
                  ↩
                </button>
              )}
              {onForwardClick && (
                <button
                  type="button"
                  onClick={() => { onForwardClick(message); setShowActions(false); }}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
                  title="Forward"
                >
                  ➜
                </button>
              )}
              {isOwn && onEditClick && message.type === "text" && (
                <button
                  type="button"
                  onClick={() => { onEditClick(message); setShowActions(false); }}
                  className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
                  title="Edit"
                >
                  ✎
                </button>
              )}
              {isOwn && onDeleteClick && (
                <button
                  type="button"
                  onClick={() => { onDeleteClick(message); setShowActions(false); }}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  🗑
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReadTicks({ read }: { read?: boolean }) {
  if (read) {
    return (
      <svg viewBox="0 0 16 15" className="w-4 h-3 text-[#53BDEB]" fill="currentColor">
        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 15" className="w-4 h-3 text-gray-400" fill="currentColor">
      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
    </svg>
  );
}
