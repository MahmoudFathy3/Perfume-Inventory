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
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, .08), 0 1px 2px rgba(15, 23, 42, .04)',
        pop: '0 20px 50px rgba(15, 23, 42, .25)'
      }
    }
  },
  plugins: []
} satisfies Config
