import type { Config } from 'tailwindcss';

type ColorFn = (args: { opacityValue?: string | number }) => string;

/**
 * Tokens are hex values, so opacity modifiers (`bg-danger/10`) need color-mix. A plain class
 * stays a bare var(): old WebViews without color-mix still get every colour that has no modifier.
 */
function token(name: string): ColorFn {
  return ({ opacityValue }) =>
    opacityValue === undefined || opacityValue === '1' || opacityValue === 1
      ? `var(--${name})`
      : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`;
}

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Opacity comes from color-mix above, never from --tw-*-opacity variables.
  corePlugins: {
    backgroundOpacity: false,
    textOpacity: false,
    borderOpacity: false,
    ringOpacity: false,
    divideOpacity: false,
    placeholderOpacity: false,
  },
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1200px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        background: token('background'),
        surface: {
          DEFAULT: token('surface'),
          foreground: token('text'), // legacy alias, removed with the old pages
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('text'), // legacy alias
        },
        popover: token('popover'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        overlay: token('overlay'),
        text: {
          DEFAULT: token('text'),
          secondary: token('text-secondary'),
          muted: token('text-muted'),
        },
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          foreground: token('primary-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          hover: token('secondary-hover'),
          foreground: token('text'), // legacy alias
        },
        success: {
          DEFAULT: token('success'),
          soft: token('success-soft'),
          foreground: token('primary-foreground'), // legacy alias
        },
        warning: {
          DEFAULT: token('warning'),
          soft: token('warning-soft'),
          foreground: token('primary-foreground'), // legacy alias
        },
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
          hover: token('danger-hover'),
          foreground: token('danger-foreground'),
        },
        info: {
          DEFAULT: token('info'),
          soft: token('info-soft'),
        },
        income: token('income'),
        expense: token('expense'),
        transfer: token('transfer'),
        debt: {
          DEFAULT: token('debt'),
          soft: token('debt-soft'),
        },
        brand: {
          DEFAULT: token('brand'),
          foreground: token('brand-foreground'),
        },
        chart: {
          1: token('chart-1'),
          2: token('chart-2'),
          3: token('chart-3'),
          4: token('chart-4'),
          5: token('chart-5'),
          6: token('chart-6'),
          7: token('chart-7'),
          8: token('chart-8'),
          9: token('chart-9'),
        },
        // Legacy aliases so pages not yet redesigned keep rendering in the new palette.
        foreground: token('text'),
        destructive: {
          DEFAULT: token('danger'),
          foreground: token('danger-foreground'),
        },
        muted: {
          DEFAULT: token('text-muted'),
          foreground: token('text-muted'),
        },
        accent: {
          DEFAULT: token('secondary-hover'),
          foreground: token('text'),
        },
      },
      ringColor: {
        DEFAULT: token('ring'),
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
      },
      fontFamily: {
        sans: ['"Onest Variable"', 'Onest', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'ft-spin': { to: { transform: 'rotate(360deg)' } },
        'ft-pulse': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        'ft-shrink': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
        'ft-bar': { '0%': { transform: 'translateX(-110%)' }, '100%': { transform: 'translateX(260%)' } },
        'ft-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'ft-pop-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'ft-sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'ft-dialog-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'ft-toast-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'ft-spin': 'ft-spin 0.8s linear infinite',
        'ft-pulse': 'ft-pulse 1.6s ease-in-out infinite',
        'ft-caret': 'ft-pulse 1s steps(1) infinite',
        'ft-bar': 'ft-bar 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'ft-fade-in': 'ft-fade-in var(--duration-base) var(--ease-out)',
        'ft-pop-in': 'ft-pop-in var(--duration-base) var(--ease-out)',
        'ft-sheet-in': 'ft-sheet-in var(--duration-slow) var(--ease-standard)',
        'ft-dialog-in': 'ft-dialog-in var(--duration-slow) var(--ease-standard)',
        'ft-toast-in': 'ft-toast-in var(--duration-base) var(--ease-out)',
      },
    },
  },
  plugins: [],
};

export default config;
