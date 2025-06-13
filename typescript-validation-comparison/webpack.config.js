const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const createConfig = (libraryName, entry) => ({
  mode: 'production',
  entry: entry,
  output: {
    path: path.resolve(__dirname, 'dist', libraryName),
    filename: `${libraryName}-bundle.js`,
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    usedExports: true,
    sideEffects: false,
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'json',
      reportFilename: `${libraryName}-report.json`,
      openAnalyzer: false,
    }),
  ],
});

module.exports = [
  createConfig('zod', './src/bundle-test/zod-bundle.ts'),
  createConfig('yup', './src/bundle-test/yup-bundle.ts'),
  createConfig('joi', './src/bundle-test/joi-bundle.ts'),
  createConfig('all', './src/bundle-test/all-bundle.ts'),
];