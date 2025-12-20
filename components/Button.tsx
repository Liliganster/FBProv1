import React from 'react';
import { LoaderIcon } from './Icons';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  children,
  ...props
}) => {
  // Base classes for all buttons: font, radius, transition, focus states
  const baseClasses = 'font-medium rounded-smooth transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center relative overflow-hidden';

  // Variant-specific classes with "High Definition" details
  const variantClasses = {
    primary: `
      bg-gradient-brand text-white 
      border border-white/10 
      shadow-[0_2px_10px_rgba(0,122,255,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] 
      hover:shadow-[0_4px_16px_rgba(0,122,255,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] 
      hover:-translate-y-[1px] active:translate-y-[0px] active:scale-[0.98]
      focus:ring-brand-primary
    `,
    secondary: `
      bg-surface-medium text-white 
      border border-white/10 
      shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]
      hover:bg-surface-light hover:border-white/20 hover:text-white
      hover:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]
      hover:-translate-y-[1px] active:translate-y-[0px] active:scale-[0.98]
      focus:ring-gray-500
    `,
    success: `
      bg-gradient-to-r from-brand-secondary to-success-dark text-white
      border border-white/10 
      shadow-[0_2px_10px_rgba(52,199,89,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]
      hover:shadow-[0_4px_16px_rgba(52,199,89,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]
      hover:-translate-y-[1px] active:translate-y-[0px] active:scale-[0.98]
      focus:ring-green-500
    `,
    danger: `
      bg-gradient-to-r from-red-600 to-red-700 text-white 
      border border-white/10 
      shadow-[0_2px_10px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]
      hover:shadow-[0_4px_16px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.3)]
      hover:-translate-y-[1px] active:translate-y-[0px] active:scale-[0.98]
      focus:ring-red-500
    `,
    ghost: `
      bg-transparent text-on-surface-secondary 
      border border-transparent
      hover:bg-white/5 hover:text-white hover:border-white/5
      active:bg-white/10 active:scale-[0.98]
      focus:ring-gray-500
    `,
    icon: `
      bg-transparent text-on-surface-secondary 
      border border-transparent
      hover:bg-white/5 hover:text-white hover:border-white/5
      active:bg-white/10 active:scale-[0.95]
      focus:ring-gray-500
      rounded-full
    `
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const iconSizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  };

  // Clean up newlines/spaces in template literals
  const cleanVariantClass = variantClasses[variant].replace(/\s+/g, ' ').trim();

  const classes = variant === 'icon'
    ? `${baseClasses} ${cleanVariantClass} ${iconSizeClasses[size]} ${className}`
    : `${baseClasses} ${cleanVariantClass} ${sizeClasses[size]} ${className}`;

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <LoaderIcon className="w-4 h-4 animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
