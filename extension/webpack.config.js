const path = require("path");

module.exports = {
  mode: "development",
  devtool: "cheap-module-source-map",
  entry: {
    content_script: "./src/content/content_script.ts",
    background: "./src/background/background.ts",
    popup: "./src/popup/Popup.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
};