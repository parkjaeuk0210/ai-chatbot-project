// PostCSS configuration for Tailwind CSS optimization
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? {
      cssnano: {
        preset: ['default', {
          discardComments: {
            removeAll: true,
          },
          minifyFontValues: {
            removeQuotes: false,
          },
        }],
      },
    } : {})
  },
}