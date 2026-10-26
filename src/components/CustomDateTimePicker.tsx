'use client';

import React from 'react';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface CustomDateTimePickerProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    dateOnly?: boolean;
    required?: boolean;
}

export default function CustomDateTimePicker({ 
    label, 
    value, 
    onChange, 
    dateOnly = false,
    required = false 
}: CustomDateTimePickerProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleContainerClick = () => {
        if (inputRef.current) {
            try {
                // showPicker() is the modern way to programmatically open the date picker
                if ('showPicker' in HTMLInputElement.prototype) {
                    inputRef.current.showPicker();
                } else {
                    inputRef.current.click();
                }
            } catch (e) {
                // Fallback for browsers that don't support showPicker or have security restrictions
                inputRef.current.click();
            }
        }
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[13px] font-semibold text-[#2563EB]/60 dark:text-[#60A5FA]/60 pl-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div 
                onClick={handleContainerClick}
                className="relative group/input flex items-center bg-white dark:bg-slate-900 border-2 border-[#2563EB]/5 dark:border-white/5 rounded-2xl p-1.5 focus-within:border-[#2563EB] dark:focus-within:border-[#60A5FA] transition-all duration-300 shadow-sm cursor-pointer"
            >
                <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-xl group-focus-within/input:bg-[#2563EB] group-focus-within/input:text-white dark:group-focus-within/input:bg-[#60A5FA] dark:group-focus-within/input:text-black transition-colors">
                    {dateOnly ? <CalendarIcon className="w-5 h-5" /> : <ClockIcon className="w-5 h-5" />}
                </div>
                <input
                    ref={inputRef}
                    type={dateOnly ? 'date' : 'datetime-local'}
                    value={value}
                    required={required}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none px-4 text-sm font-bold text-gray-800 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 appearance-none pointer-events-auto cursor-pointer"
                    style={{ colorScheme: 'auto' }}
                />
            </div>
        </div>
    );
}
