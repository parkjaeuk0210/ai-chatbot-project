// PostCSS configuration for Tailwind CSS optimization
export default {
  plugins: {
    '@tailwindcss/postcss': {},
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