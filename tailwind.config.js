/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg0: '#070A13',
        bg1: '#0B1024',
        panel: 'rgba(255,255,255,0.06)',
        panel2: 'rgba(255,255,255,0.08)',
        neonBlue: '#4CC9F0',
        neonPurple: '#B517FF',
        neonPink: '#FF4DDE'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(76,201,240,0.15), 0 12px 40px rgba(0,0,0,0.55)',
        card: '0 0 0 1px rgba(255,255,255,0.08), 0 18px 60px rgba(0,0,0,0.55)'
      },
      borderRadius: {
        '2xl': '1.25rem'
      },
      backgroundImage: {
        'neon-radial': 'radial-gradient(1200px circle at 20% -10%, rgba(76,201,240,0.22), transparent 60%), radial-gradient(900px circle at 90% 10%, rgba(181,23,255,0.22), transparent 55%), radial-gradient(900px circle at 40% 120%, rgba(255,77,222,0.16), transparent 60%)'
      }
    }
  },
  plugins: []
}
