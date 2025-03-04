const { merge } = require('webpack-merge');
const common = require('./webpack.common');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({})],
  },
  output: { // Настройка выходного файла
    path: path.resolve(__dirname, "../dist"), // Путь относительно корня проекта
    filename: "main.js",
  },
});
