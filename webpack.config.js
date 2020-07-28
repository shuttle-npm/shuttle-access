let glob = require("glob");

module.exports = env => {
  let entry = __dirname + "/src/shuttle-access.js";
  let outputPath = __dirname + "/dist/";
  let outputFileName = "shuttle-access.js"
  let mode = "production";

  if (env.TESTING) {
    entry = glob.sync(__dirname + "/test/test.js");
    outputPath = __dirname + "/test/";
    outputFileName = "bundle-test.js";
    mode = "development";
  }

  return {
    mode: mode,
    entry: entry,
    output: {
      path: outputPath,
      filename: outputFileName
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: ["/node_modules/"],
          use: [
            {
              loader: "babel-loader",
              options: {
                presets: ["@babel/env"],
              },
            },
          ],
        },
      ],
    },
    performance: { hints: false } 
  }
};
