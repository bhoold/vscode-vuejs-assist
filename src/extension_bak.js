// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const _ = require('lodash');
const esprima = require('esprima');






const nodeDependencies_1 = require("./nodeDependencies");


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    const rootPath = vscode.workspace.rootPath;
	const nodeDependenciesProvider = new nodeDependencies_1.DepNodeProvider(rootPath);
	
	//vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);

	vscode.window.registerTreeDataProvider("nodeDependencies", {
		onDidChangeTreeData: null,
		getChildren (element) {console.log(111)
			

			let str = vscode.window.activeTextEditor.document.getText();
			let jsStr = str.slice(str.indexOf('<script>') + '<script>'.length, str.indexOf('</script>'));
			let analyzeArr = esprima.tokenize(jsStr);


			console.log(analyzeArr)
			if(element && element.label == "template"){
				return [
					new vscode.TreeItem(
						"div", 
						vscode.TreeItemCollapsibleState.None
					),
					new vscode.TreeItem(
						"p", 
						vscode.TreeItemCollapsibleState.None
					)
				]
			}
			if(element && element.label == "script"){
				return [
					new vscode.TreeItem(
						"name", 
						vscode.TreeItemCollapsibleState.None
					),
					new vscode.TreeItem(
						"data", 
						vscode.TreeItemCollapsibleState.None
					),
					new vscode.TreeItem(
						"methods", 
						vscode.TreeItemCollapsibleState.None
					),
					new vscode.TreeItem(
						"created", 
						vscode.TreeItemCollapsibleState.None
					),
					new vscode.TreeItem(
						"mounted", 
						vscode.TreeItemCollapsibleState.None
					),
					new vscode.TreeItem(
						"watch", 
						vscode.TreeItemCollapsibleState.None
					)
				]
			}

			return [
				new vscode.TreeItem(
					"template", 
					vscode.TreeItemCollapsibleState.Collapsed
				),
				new vscode.TreeItem(
					"script", 
					vscode.TreeItemCollapsibleState.Collapsed
				),
				new vscode.TreeItem(
					"style", 
					vscode.TreeItemCollapsibleState.None
				)
			]
		},
		getParent () {
			console.log(333)
		},
		getTreeItem (element) {
			console.log(222)
			return element;
		}
	});



    vscode.commands.registerCommand('nodeDependencies.refreshEntry', () => nodeDependenciesProvider.refresh());
    vscode.commands.registerCommand('nodeDependencies.addEntry', node => vscode.window.showInformationMessage('Successfully called add entry'));
    vscode.commands.registerCommand('nodeDependencies.deleteEntry', node => vscode.window.showInformationMessage('Successfully called delete entry'));






    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "class-view" is now active!');

	/* _.each(vscode, (value, key) => {
		console.log(key)
	}) */


}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;