import { useState, useRef, useEffect, useCallback } from "react";
import EmojiPicker from "emoji-picker-react";
import { useReactMediaRecorder } from "react-media-recorder";
import {
  PaperClipIcon,
  FaceSmileIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  TrashIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import type { ChatMessage } from "@/types/chat";
import { formatRecordingDuration } from "@/lib/chat-time";

interface ChatInputProps {
  onSendMessage: (
    text: string,
    type: "text" | "image" | "file" | "audio",
    mediaUrl?: string,
    replyToId?: string
  ) => void;
  isSending: boolean;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

function RecordingWaveform({ active }: { active: boolean }) {
  const bars = [3, 5, 8, 4, 7, 6, 9, 5, 8, 4, 6, 7, 5, 8, 6, 4, 7, 5, 9, 6, 4, 8, 5, 7];
  return (
    <div className="flex-1 flex items-center gap-[2px] h-8 px-2 overflow-hidden">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full bg-[#25D366] ${active ? "animate-pulse" : "opacity-60"}`}
          style={{
            height: `${h * 3}px`,
            animationDelay: `${i * 0.05}s`,
            animationDuration: active ? `${0.4 + (i % 5) * 0.1}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default function ChatInput({
  onSendMessage,
  isSending,
  replyTo,
  onCancelReply,
  onTypingStart,
  onTypingStop,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSendRef = useRef(false);

  const {
    status,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    mediaBlobUrl,
    clearBlobUrl,
  } = useReactMediaRecorder({ audio: true });

  const isRecording = status === "recording";
  const isPreview = !!mediaBlobUrl && !isRecording;

  useEffect(() => {
    if (!isRecording || isPaused) return;
    const interval = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (status === "idle" && !mediaBlobUrl) {
      setRecordingSeconds(0);
      setIsPaused(false);
    }
  }, [status, mediaBlobUrl]);

  const uploadAndSend = useCallback(
    async (blobUrl: string) => {
      setUploading(true);
      try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const file = new File([blob], "voice-note.webm", { type: blob.type || "audio/webm" });
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success && data.fileId) {
          onSendMessage("Voice Note", "audio", data.fileId, replyTo?.id);
          clearBlobUrl();
          setRecordingSeconds(0);
        }
      } finally {
        setUploading(false);
        pendingSendRef.current = false;
      }
    },
    [onSendMessage, replyTo?.id, clearBlobUrl]
  );

  useEffect(() => {
    if (mediaBlobUrl && pendingSendRef.current) {
      uploadAndSend(mediaBlobUrl);
    }
  }, [mediaBlobUrl, uploadAndSend]);

  const handleCancelRecording = () => {
    pendingSendRef.current = false;
    if (isRecording) stopRecording();
    clearBlobUrl();
    setRecordingSeconds(0);
    setIsPaused(false);
  };

  const handleTogglePause = () => {
    if (isPaused) {
      resumeRecording();
      setIsPaused(false);
    } else {
      pauseRecording();
      setIsPaused(true);
    }
  };

  const handleSendAudio = () => {
    if (isRecording) {
      pendingSendRef.current = true;
      stopRecording();
      return;
    }
    if (mediaBlobUrl) uploadAndSend(mediaBlobUrl);
  };

  const handleTyping = useCallback(() => {
    onTypingStart?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTypingStop?.(), 2000);
  }, [onTypingStart, onTypingStop]);

  const handleSendText = () => {
    if (text.trim() && !isSending) {
      onSendMessage(text, "text", undefined, replyTo?.id);
      setText("");
      setShowEmoji(false);
      onTypingStop?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.fileId) {
        const type = file.type.startsWith("image/") ? "image" : "file";
        onSendMessage(file.name, type, data.fileId, replyTo?.id);
      } else {
        alert("Upload failed: " + data.error);
      }
    } catch {
      alert("Error uploading file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative bg-[#F0F2F5] px-3 py-2 shrink-0">
      {uploading && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-3 py-1 rounded-full text-[14px] z-50">
          Sending voice note...
        </div>
      )}

      {replyTo && !isRecording && !isPreview && (
        <div className="flex items-center gap-2 mb-2 bg-white rounded-lg px-3 py-2 border-l-4 border-[#25D366]">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-medium text-[#25D366]">{replyTo.sender_id}</p>
            <p className="text-sm text-gray-600 truncate">
              {replyTo.type === "text" ? replyTo.text : `[${replyTo.type}]`}
            </p>
          </div>
          <button onClick={onCancelReply} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {showEmoji && !isRecording && !isPreview && (
        <div ref={emojiRef} className="absolute bottom-full left-2 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden">
          <EmojiPicker onEmojiClick={(e) => setText((prev) => prev + e.emoji)} theme={"auto" as any} />
        </div>
      )}

      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

      {isRecording || isPreview ? (
        /* WhatsApp-style voice recorder bar */
        <div className="flex items-center gap-1 bg-white rounded-full px-2 py-1.5 shadow-sm min-h-[52px]">
          <button
            type="button"
            onClick={handleCancelRecording}
            className="p-2.5 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100 shrink-0"
            title="Discard"
          >
            <TrashIcon className="w-5 h-5" />
          </button>

          {isRecording ? (
            <>
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
              <span className="text-sm text-gray-700 tabular-nums min-w-[32px] shrink-0">
                {formatRecordingDuration(recordingSeconds)}
              </span>
              <RecordingWaveform active={!isPaused} />
              <button
                type="button"
                onClick={handleTogglePause}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full shrink-0"
                title={isPaused ? "Resume" : "Pause"}
              >
                {isPaused ? <PlayIcon className="w-5 h-5" /> : <PauseIcon className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-600 tabular-nums min-w-[32px] shrink-0 pl-1">
                {formatRecordingDuration(recordingSeconds)}
              </span>
              <RecordingWaveform active={false} />
              {mediaBlobUrl && (
                <audio src={mediaBlobUrl} className="hidden" />
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleSendAudio}
            disabled={isSending || uploading}
            className="w-11 h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:bg-[#20bd5a] disabled:opacity-50 shrink-0 shadow-md"
            title="Send voice note"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full"
          >
            <FaceSmileIcon className="w-6 h-6" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full"
          >
            <PaperClipIcon className="w-6 h-6" />
          </button>

          <div className="flex-1 bg-white rounded-lg">
            <textarea
              className="w-full bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 p-2.5 max-h-32 min-h-[42px] resize-none text-sm"
              placeholder="Type a message"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => onTypingStop?.()}
              rows={1}
            />
          </div>

          {text.trim() ? (
            <button
              onClick={handleSendText}
              disabled={isSending || uploading}
              className="p-2.5 bg-[#25D366] text-white rounded-full hover:bg-[#20bd5a] disabled:opacity-50"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                setRecordingSeconds(0);
                startRecording();
              }}
              className="p-2.5 text-gray-500 hover:text-gray-700 rounded-full"
            >
              <MicrophoneIcon className="w-6 h-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
