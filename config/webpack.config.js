const path = require('path');
const fs = require('fs');
process.env.NODE_ENV = 'development';

function getEntry() {
    const entry = {};
    fs.readdirSync(path.resolve(__dirname, '../src')).filter(item => item.indexOf('.js') > -1).forEach(pathname => {
        const idx = pathname.indexOf('.');
        entry[pathname.slice(0, idx)] =  path.resolve(__dirname, '../src/' + pathname)
    })
    return entry;
}
console.log(getEntry())
module.exports = {
    mode: 'development',
    target: 'web',
    devtool: 'cheap-module-source-map',
    entry: getEntry(),
    output: {
        path: path.resolve(__dirname, '../build'),
        publicPath: '/',
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /(node_modules)/,
                loader: 'babel-loader',
            }
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss'],
        modules: ['node_modules', path.resolve(__dirname, '../src')]
    }
};
