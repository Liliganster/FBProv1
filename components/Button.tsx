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
  const baseClasses = 'font-semibold rounded-smooth transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center';
  
  const variantClasses = {
    primary: 'bg-gradient-brand text-white hover:shadow-brand hover:scale-[1.02] focus:ring-brand-primary',
    secondary: 'bg-gray-600/40 hover:bg-gray-600 text-white border border-gray-500/60 focus:ring-gray-500',
    success: 'bg-brand-secondary hover:bg-green-500 text-white hover:shadow-md hover:shadow-green-500/30 hover:scale-[1.02] focus:ring-green-500',
    danger: 'bg-gradient-to-r from-red-600 to-red-700 hover:shadow-md hover:shadow-red-500/30 hover:scale-[1.02] text-white focus:ring-red-500',
    ghost: 'bg-transparent hover:bg-gradient-surface text-on-surface-secondary hover:text-white border border-transparent hover:border-gray-500/50 focus:ring-gray-500',
    icon: 'bg-transparent hover:bg-gradient-surface text-on-surface-secondary hover:text-white p-2 focus:ring-gray-500'
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
  
  const classes = variant === 'icon' 
    ? `${baseClasses} ${variantClasses[variant]} ${iconSizeClasses[size]} ${className}`
    : `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
  
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

