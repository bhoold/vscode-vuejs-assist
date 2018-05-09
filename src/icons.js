const path = require('path');
const vscode = require('vscode');

const getIcon = (kind, context) => {
	//context是vscode.ExtensionContext类型
	let icon;
	switch (kind) {
		case vscode.SymbolKind.Class:
			icon = "class";
			break;
		case vscode.SymbolKind.Constant:
			icon = "constant";
			break;
		case vscode.SymbolKind.Constructor:
		case vscode.SymbolKind.Function:
		case vscode.SymbolKind.Method:
			icon = "function";
			break;
		case vscode.SymbolKind.Interface:
			icon = "interface";
			break;
		case vscode.SymbolKind.Module:
		case vscode.SymbolKind.Namespace:
		case vscode.SymbolKind.Object:
		case vscode.SymbolKind.Package:
			icon = "module";
			break;
		case vscode.SymbolKind.Property:
			icon = "property";
			break;
		default:
			icon = "variable";
			break;
	}
	icon = `icon-${icon}.svg`;
	return {
		dark: context.asAbsolutePath(path.join("resources", "dark", icon)),
		light: context.asAbsolutePath(path.join("resources", "light", icon))
	};
}

exports.getIcon = getIcon;