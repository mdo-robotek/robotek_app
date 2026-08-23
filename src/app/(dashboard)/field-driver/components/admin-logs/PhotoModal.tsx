'use client';

export default function PhotoModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt="Odometer" className="w-full h-auto rounded-2xl shadow-2xl" />
        <button
          type="button"
          className="absolute -top-3 -right-3 w-10 h-10 bg-white text-black font-black rounded-full shadow-lg"
          onClick={onClose}
        >
          X
        </button>
      </div>
    </div>
  );
}
