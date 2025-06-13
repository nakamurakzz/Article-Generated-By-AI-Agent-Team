const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const createConfig = (libraryName, entry) => ({
  mode: 'production',
  entry: entry,
  output: {
    path: path.resolve(__dirname, 'dist-minimal', libraryName),
    filename: `${libraryName}-minimal.js`,
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
      reportFilename: `${libraryName}-minimal-report.json`,
      openAnalyzer: false,
    }),
  ],
});

module.exports = [
  createConfig('zod', './src/bundle-test/minimal-zod.ts'),
  createConfig('yup', './src/bundle-test/minimal-yup.ts'),
  createConfig('joi', './src/bundle-test/minimal-joi.ts'),
];