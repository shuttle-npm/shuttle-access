const webpack = require('webpack');
const Mocha = require('mocha');
const fs = require('fs');

const mocha = new Mocha();
const bundleFile = __dirname + "/bundle-test.js";

mocha.addFile(bundleFile);

webpack({
    mode: "development",
    entry: __dirname + "/test.js",
    output: {
        path: __dirname,
        filename: "bundle-test.js"
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
}, (err, stats) => { 
    if (err) {
        console.error(err.stack || err);
        if (err.details) {
            console.error(err.details);
        }
        return;
    }

    const info = stats.toJson();

    if (stats.hasErrors()) {
        console.error(info.errors);
    }

    if (stats.hasWarnings()) {
        console.warn(info.warnings);
    }

    if (!err && !stats.hasErrors()) {
        mocha.run(function (failures) {
            fs.unlinkSync(bundleFile)
        });
    }
});
