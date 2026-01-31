import React from 'react';
import { cn } from '../../lib/utils';
import { type LucideIcon } from 'lucide-react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: LucideIcon;
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon: Icon, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-2">
        {label && (
          <label className="text-sm font-medium text-gray-700 ml-1">
            {label}
          </label>
        )}
        <div className={cn(
          "relative flex items-center bg-input-bg rounded-2xl transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-primary-start/50",
          error && "ring-2 ring-red-400 bg-red-50",
          className
        )}>
          {Icon && (
            <div className="pl-4 text-gray-400">
              <Icon size={20} />
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-transparent border-none p-4 text-gray-700 placeholder-gray-400 focus:outline-none",
              Icon ? "pl-3" : "pl-4"
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-500 ml-1 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
