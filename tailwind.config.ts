import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // اللون الأساسي للتطبيق (تيل). غيّره من هنا بس.
        primary: colors.teal,
        surface: '#ffffff',
        canvas: '#f1f5f9'
      },
      fontFamily: { sans: ['Cairo', 'system-ui', 'sans-serif'] },
      keyframes: {
        'toast-in': { from: { opacity: '0', transform: 'translateY(-12px) scale(.97)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } }
      },
      animation: { 'toast-in': 'toast-in .22s ease-out' },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, .08), 0 1px 2px rgba(15, 23, 42, .04)',
        pop: '0 20px 50px rgba(15, 23, 42, .25)'
      }
    }
  },
  plugins: []
} satisfies Config
