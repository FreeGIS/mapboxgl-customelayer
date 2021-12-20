const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
//const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

const exampleList = require('./exampleList');
const exampleNames = exampleList.map(f => path.basename(f));

fs.mkdirSync(path.resolve(__dirname, '../gen'), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, '../gen/exampleLoader.js'), `
${exampleNames.map(name => {
  return `
  export const ${name} = async () => (await import('../src/examples/${name}'));
  `;
}).join('\n')}
`, 'utf-8')

module.exports = {
  mode: 'production',
  target: 'web',
  entry: exampleNames.reduce((acc, name) => {
    return Object.assign(acc, {
      [name]: path.resolve(__dirname, '../src/examples', name),
    });
  }, {
    main: path.resolve(__dirname, '../src/main'),
  }),
  externals: {
    'mapbox-gl': 'mapboxgl'
  },// 配置不打包文件
  output: {
    path: path.resolve(__dirname, '../dist'),
    chunkFilename: '[name]-[chunkhash:6].js',
    filename: `[name]-[hash:6].js`,
    publicPath: 'dist/',
  },
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.worker\.js$/,
        use: { loader: 'worker-loader' }
      },
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        exclude: /node_modules/,
        use: [
          'raw-loader',
          'glslify-loader'
        ]
      }
    ]
  },
  optimization: {
    splitChunks: {
      // Split each example into its own chunk
      cacheGroups: exampleNames.reduce((acc, name) => {
        return Object.assign(acc, {
          [name]: {
            test: new RegExp(`/examples/${name}`),
            name,
            priority: 100,
            enforce: true,
          }
        })
      }, {
        default: {
          enforce: true,
          priority: 1,
          name: 'common',
        },
      }),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'CustomeLayer教程',
      filename: '../index.html',
      template: path.resolve(__dirname, '../src/index.html'),
      examples: exampleNames,
      excludeChunks: exampleNames,
    }),
    /*new WasmPackPlugin({
      crateDirectory: path.resolve(__dirname, ".")
    })*/
  ],
  devtool: 'source-map',
  //watchOptions: {
  //ignored: ['dist/**/*.js', 'index.html']
  //},

  node: {
    fs: 'empty',
  },
};
