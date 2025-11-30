/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'sm': '14px',
        'base': '16px',
        'lg': '28px',
        'xl': '28px',
        '2xl': '28px',
        '3xl': '28px',
        '4xl': '28px',
        '5xl': '28px',
      },
      colors: {
        // Brand Colors - Professional Blue
        'brand-primary': '#007aff',
        'brand-primary-dark': '#0056cc',
        'brand-secondary': '#34c759',
        'brand-accent': '#5856d6',

        // Dark Theme Base Colors
        'background-dark': '#0a0a0a',
        'background-darker': '#000000',
        'surface-dark': '#1a1a1a',
        'surface-medium': '#2a2a2a',
        'surface-light': '#3a3a3a',

        // Text Colors
        'on-surface-dark': '#ffffff',
        'on-surface-medium': '#e5e5e5',
        'on-surface-secondary': '#a3a3a3',
        'on-surface-tertiary': '#6b7280',

        // Border Colors
        'border-dark': '#2a2a2a',
        'border-medium': '#404040',
        'border-light': '#525252',

        // Status Colors (Dark Theme)
        'success-dark': '#10b981',
        'warning-dark': '#f59e0b',
        'error-dark': '#ef4444',
        'info-dark': '#3b82f6',
      },
      backgroundImage: {
        // Professional Dark Gradients
        'gradient-dark': 'linear-gradient(135deg, #111827 0%, #8fbf99 100%)',
        'gradient-surface': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        'gradient-brand': 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
        'gradient-brand-subtle': 'linear-gradient(135deg, #007aff20 0%, #5856d620 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(26, 26, 26, 0.8) 0%, rgba(42, 42, 42, 0.8) 100%)',
        'gradient-overlay': 'linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.8) 100%)',
        'on-surface-dark-secondary': '#a3a3a3',
        'on-surface-tertiary': '#6b7280',
      },
      borderRadius: {
        'micro': '2px',     // Micro elementos: badges, dots
        'subtle': '4px',    // Elementos pequeños: inputs, small buttons
        'soft': '6px',      // Botones medianos, tags
        'smooth': '8px',    // Botones principales, cards pequeños
        'gentle': '12px',   // Cards medianos, panels
        'fluid': '16px',    // Cards grandes, containers
        'organic': '20px',  // Modales, hero sections
        'natural': '24px',  // Special containers, features
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
        'glass-lg': '0 16px 64px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3)',
        'brand': '0 4px 16px rgba(0, 122, 255, 0.2)',
        'brand-lg': '0 8px 32px rgba(0, 122, 255, 0.3)',
        'surface': '0 2px 8px rgba(0, 0, 0, 0.5)',
        'surface-lg': '0 4px 16px rgba(0, 0, 0, 0.6)',
      },
      backdropBlur: {
        'glass': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fadeIn': 'fadeIn 0.2s ease-in-out',
        'slideInLeft': 'slideInLeft 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 122, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 122, 255, 0.4)' },
        },
      },
    },
  },
  plugins: [],
}
