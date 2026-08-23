import { ReactNode } from 'react';

export function FieldCard({
  title,
  icon,
  children,
  className = '',
  headerRight,
  compact = false,
}: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border border-gray-200/80 dark:border-white/10 shadow-sm ${className} ${
        className.includes('h-full') ? 'flex flex-col' : ''
      }`}
    >
      {title && (
        <div
          className={`flex items-center justify-between gap-2 border-b border-gray-100 dark:border-white/10 shrink-0 ${
            compact ? 'px-3 py-2' : 'px-4 py-3'
          }`}
        >
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#062B6F] dark:text-[#FFD500]">
              {title}
            </h3>
          </div>
          {headerRight}
        </div>
      )}
      <div className={`${compact ? 'p-3' : 'p-4'} ${className.includes('h-full') ? 'flex-1 flex flex-col' : ''}`}>
        {children}
      </div>
    </div>
  );
}
