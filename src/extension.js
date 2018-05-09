const vueView = require("./vueView");


function activate(context) {
	new vueView.SymbolOutlineProvider(context);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;