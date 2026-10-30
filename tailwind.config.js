/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 完整 0-100 透明度刻度，使 /8 /12 /6 等非 5 倍数的颜色透明度修饰符可用
      opacity: Object.fromEntries(
        Array.from({ length: 101 }, (_, i) => [i, (i / 100).toString()]),
      ),
      colors: {
        // 深空蓝底色板
        void: {
          950: '#03070f',
          900: '#060d1a',
          850: '#081326',
          800: '#0a1a33',
          700: '#0f2444',
          600: '#163357',
        },
        // 青色主高亮
        cyber: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          glow: '#67e8f9',
        },
        // 品红告警
        alarm: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        // 琥珀警告
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        // 状态绿
        online: {
          400: '#34d399',
          500: '#10b981',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
        display: ['"Orbitron"', '"Rajdhani"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(34,211,238,0.12), 0 8px 32px rgba(0,0,0,0.55)',
        glow: '0 0 16px rgba(34,211,238,0.45)',
        'glow-sm': '0 0 8px rgba(34,211,238,0.35)',
        'glow-alarm': '0 0 16px rgba(244,63,94,0.5)',
      },
      backgroundImage: {
        'grid-cyan':
          'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
        'radial-fade':
          'radial-gradient(ellipse at center, rgba(8,145,178,0.15) 0%, transparent 70%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '94%': { opacity: '0.6' },
          '96%': { opacity: '1' },
        },
      },
      animation: {
        scanline: 'scanline 4s linear infinite',
        pulseGlow: 'pulseGlow 1.6s ease-in-out infinite',
        marquee: 'marquee 30s linear infinite',
        flicker: 'flicker 6s linear infinite',
      },
    },
  },
  plugins: [],
}
