// Tailwind CSS configuration for production optimization
module.exports = {
  content: [
    './index.html',
    './index-secure.html',
    './js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        'glass-bg': 'var(--glass-bg)',
        'glass-border': 'var(--glass-border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite'
      }
    }
  },
  plugins: [],
  // Production optimizations
  corePlugins: {
    // Disable unused core plugins
    float: false,
    objectFit: false,
    objectPosition: false,
    listStyleType: false,
    listStylePosition: false,
    textDecoration: false,
    textTransform: false,
    fontSmoothing: false,
    fontVariantNumeric: false,
    letterSpacing: false,
    userSelect: false,
    verticalAlign: false,
    visibility: false,
    whitespace: false,
    wordBreak: false,
    gridAutoFlow: false,
    gridTemplateColumns: false,
    gridColumn: false,
    gridColumnStart: false,
    gridColumnEnd: false,
    gridTemplateRows: false,
    gridRow: false,
    gridRowStart: false,
    gridRowEnd: false
  }
}