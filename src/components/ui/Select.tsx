import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { type LucideIcon } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  icon: Icon,
  placeholder = "Select an option",
  className,
  disabled = false,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    if (!disabled) {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("w-full space-y-2", className)} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700 ml-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "relative w-full flex items-center bg-input-bg rounded-2xl p-4 text-left transition-all duration-200 focus:outline-none",
            "border border-transparent focus:ring-2 focus:ring-brand-primary-start/50",
            error && "ring-2 ring-red-400 bg-red-50",
            disabled && "opacity-60 cursor-not-allowed",
            isOpen && "rounded-b-none ring-2 ring-brand-primary-start/50 bg-white shadow-lg" // Lift effect on open
          )}
          disabled={disabled}
        >
          {Icon && (
            <div className="mr-3 text-gray-400">
              <Icon size={20} />
            </div>
          )}
          
          <span className={cn(
            "flex-1 text-base",
            !selectedOption ? "text-gray-400" : "text-gray-700"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          
          <div className="ml-2 text-gray-400">
            <ChevronDown size={20} className={cn("transition-transform duration-200", isOpen && "transform rotate-180")} />
          </div>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-[-2px] bg-white border border-t-0 border-gray-100 rounded-b-2xl shadow-xl max-h-60 overflow-auto py-2">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "px-4 py-3 cursor-pointer flex items-center justify-between transition-colors",
                  "hover:bg-brand-bg",
                  value === option.value && "bg-brand-primary-start/5 text-brand-primary-start font-medium"
                )}
              >
                <div className="flex items-center">
                   {/* Optional: Add icons to options if needed in future */}
                   {option.label}
                </div>
                {value === option.value && <Check size={16} />}
              </div>
            ))}
            
            {options.length === 0 && (
                <div className="px-4 py-3 text-gray-400 text-sm text-center">No options available</div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 ml-1 mt-1">{error}</p>
      )}
    </div>
  );
};
