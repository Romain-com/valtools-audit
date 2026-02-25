import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Palette Valraiso ──────────────────────────────────────────
        brand: {
          orange: '#E84520',
          'orange-light': '#F4A582',
          purple: '#6B72C4',
          'purple-light': '#9EA4DC',
          yellow: '#F5B731',
          cream: '#FAF0DC',
          navy: '#1A2137',
          bg: '#F3F5FA',
          surface: '#FFFFFF',
          border: '#E2E6F0',
        },
        // ── Sémantiques UI ────────────────────────────────────────────
        status: {
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
          pending: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        sm: '0 1px 3px 0 rgba(26,33,55,0.08)',
        DEFAULT: '0 2px 8px 0 rgba(26,33,55,0.10)',
        md: '0 4px 16px 0 rgba(26,33,55,0.12)',
        lg: '0 8px 32px 0 rgba(26,33,55,0.16)',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-down': 'slideDown 0.2s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'skier-move': 'skierMove 3s ease-in-out infinite',
      },
      keyframes: {
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        skierMove: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
