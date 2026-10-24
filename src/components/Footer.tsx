// Theme Step 1 (Oct 2026): quiet one-line footer (was a dark navy bar
// with a scrolling yellow marquee that took space on every page).
export default function Footer() {
  return (
    <footer className="h-10 shrink-0 flex items-center justify-between px-4 md:px-6 text-[13px] text-[#5B6472] dark:text-slate-500 border-t border-[#E5E7EB] dark:border-navy-800 bg-white dark:bg-navy-900">
      <span>&copy; 2026 Robotek Industries</span>
      <span className="hidden sm:inline">Developed by Sohan · 7217685179</span>
    </footer>
  );
}
