import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' }
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        info: 'hsl(var(--info))',
        // Scoring semantic colors (target face inspired)
        score: {
          x: 'hsl(48 96% 50%)',
          '10': 'hsl(48 96% 50%)',
          '9': 'hsl(48 96% 50%)',
          '8': 'hsl(0 84% 55%)',
          '7': 'hsl(0 84% 55%)',
          '6': 'hsl(210 90% 55%)',
          '5': 'hsl(210 90% 55%)',
          '4': 'hsl(0 0% 30%)',
          '3': 'hsl(0 0% 30%)',
          '2': 'hsl(0 0% 95%)',
          '1': 'hsl(0 0% 95%)',
          miss: 'hsl(0 0% 60%)'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        // Crisper than Tailwind's defaults for cards-on-cards
        card: '0 1px 2px 0 hsl(222 47% 11% / 0.04), 0 1px 3px 0 hsl(222 47% 11% / 0.06)',
        'card-hover': '0 2px 4px 0 hsl(222 47% 11% / 0.06), 0 4px 12px -2px hsl(222 47% 11% / 0.08)',
        glow: '0 0 0 4px hsl(var(--ring) / 0.18)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in-scale': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'slide-up-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'fade-in-up': 'fade-in-up 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in-scale': 'fade-in-scale 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up-in': 'slide-up-in 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        'press': 'press 120ms ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite'
      },
      transitionTimingFunction: {
        'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
