import React from 'react';
import { cn } from '../../lib/utils';


interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-gradient-to-r from-brand-primary-start to-brand-primary-end text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
      secondary: 'bg-brand-secondary text-white shadow-md hover:shadow-lg hover:bg-brand-secondary/90 active:scale-[0.98]',
      outline: 'border-2 border-brand-primary-start text-brand-primary-start hover:bg-brand-primary-start/10',
      ghost: 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800',
    };

    const sizes = {
      sm: 'h-9 px-4 text-sm',
      md: 'h-11 px-6 text-base',
      lg: 'h-14 px-8 text-lg',
      icon: 'h-10 w-10 p-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
