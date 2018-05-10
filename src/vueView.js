const vscode = require('vscode');
const icons = require('./icons');
const _ = require('lodash');
//const esprima = require('esprima')
const acorn = require('acorn')

let optsSortOrder = [],
	optsTopLevel = [],
	optsExpandNodes = [],
	optsDoSort = true;

class SymbolNode {

    constructor(symbol) {
		this.symbol = symbol;
		this.children = [];

		this.parent = null;
	}

	static shouldAutoExpand (kind) {
		let ix = optsExpandNodes.indexOf(kind);
		if(ix < 0){
			ix = optsExpandNodes.indexOf(-1);
		}
		return ix > -1;
	}
	
	addChild (child) {
		child.parent = this;
		this.children.push(child);
	}

	sort () {
		this.children.sort(this.compareSymbols.bind(this));
		this.children.forEach(child => child.sort());
	}

	compareSymbols (a, b) {
		const kindOrder = this.getKindOrder(a.symbol.kind) - this.getKindOrder(b.symbol.kind);
		if(kindOrder !== 0){
			return kindOrder;
		}
		if(a.symbol.name.toLowerCase() > b.symbol.name.toLowerCase()){
			return 1;
		}
		return -1;
	}

	getKindOrder (kind) {
		let ix = optsSortOrder.indexOf(kind);
		if(ix < 0){
			ix = optsSortOrder.indexOf(-1);
		}
		return ix;
	}

}

class SymbolOutlineTreeDataProvider {

    constructor(context) {
		//继承属性
        this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		
		this.context = context;
		this.tree = null;
		this.editor = null;
	}

	//继承方法
	async getChildren (element) {
		if(element){
			return element.children;
		}else{
			//await this.updateSymbols(vscode.window.activeTextEditor);
			await this.updateSymbolsBySelf(vscode.window.activeTextEditor);
			return this.tree ? this.tree.children : [];
		}
	}

	//继承方法
	getParent (element) {
		return element.parent;
	}

	//继承方法
	getTreeItem (element) {
		const { kind } = element.symbol;
		let treeItem = new vscode.TreeItem(element.symbol.name);
		if(element.children.length){
			treeItem.collapsibleState =
				optsExpandNodes.length && SymbolNode.shouldAutoExpand(kind)
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.Collapsed;
		}else{
			treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
		}

		treeItem.command = {
			command: "vueView.revealRange",
			title: "",
			arguments: [this.editor, element.symbol.location.range]
		};

		treeItem.iconPath = icons.getIcon(kind, this.context);
		return treeItem;
	}

	refresh () {
		this._onDidChangeTreeData.fire();
	}

	//获取符号
	getSymbols (document) {
		return vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", document.uri);
	}

	//比较符号
	compareSymbols (a, b) {
		const startComparison = a.symbol.location.range.start.compareTo(b.symbol.location.range.start);
		if (startComparison != 0) {
			return startComparison;
		}
		return b.symbol.location.range.end.compareTo(a.symbol.location.range.end);
	}

	//更新符号
	async updateSymbols (editor) {
		const tree = new SymbolNode();
		this.editor = editor;
		if(editor && editor.document.languageId == "vue"){
			readOpts();
			let symbols = await this.getSymbols(editor.document);
			if (optsTopLevel.indexOf(-1) < 0) {
				symbols = symbols.filter(sym => optsTopLevel.indexOf(sym.kind) >= 0);
			}console.log(vscode)
			const symbolNodes = symbols.map(symbol => new SymbolNode(symbol));
			symbolNodes.sort(this.compareSymbols);
			let potentialParents = [];
			symbolNodes.forEach(currentNode => {
				potentialParents = potentialParents
				.filter(node => node !== currentNode && node.symbol.location.range.contains(currentNode.symbol.location.range))
				.sort(this.compareSymbols);
				if(!potentialParents.length){
					tree.addChild(currentNode);
				}else{
					const parent = potentialParents[potentialParents.length - 1];
					parent.addChild(currentNode);
				}
				potentialParents.push(currentNode);
			});
			if (optsDoSort) {
				tree.sort();
			}
		}
		this.tree = tree;
	}

	getNodeByPosition (position) {
		let node = this.tree;
		while(node.children.length){
			const matching = node.children.filter(node => node.symbol.location.range.contains(position));
			if(!matching.length){
				break;
			}
			node = matching[0];
		}
		if(node.symbol){
			return node;
		}
	}

	async updateSymbolsBySelf (editor) {
		const tree = new SymbolNode();
		this.editor = editor;
		if(editor && editor.document.languageId == "vue"){
			readOpts();
			let symbols = await this.getSymbols(editor.document);

			_.each(symbols, item => {
				if(item.name == "script"){
					let symbolNode = new SymbolNode(item);
					tree.addChild(symbolNode);
					return false;
				}
			});

			//symbol结构
			//let symbol = new vscode.SymbolInformation("aaa", vscode.SymbolKind.Method, "script", new vscode.Location(editor.document.uri, new vscode.Range(new vscode.Position(5,5), new vscode.Position(5,6))))
			let parentNode = null;
			if(_.isArray(tree.children) && tree.children[0]){//children[0]是script标签
				parentNode = tree.children[0];
			}else{
				parentNode = tree;
			}
			

			//使用acorn解析
			let scriptSymbol = null;
			let scriptText = "";
			let ast = null;
			
			_.each(symbols, item => {
				if(item.name == "script"){
					scriptSymbol = item;
					scriptText = editor.document.getText(item.location.range);
					scriptText = scriptText.slice(scriptText.indexOf('>') + 1, scriptText.lastIndexOf('</'));
					try{
						ast = acorn.parse(scriptText,{
							sourceType: 'module',
							ranges: true
						})
					}catch(e){
						console.log(e)
					}
					return false;
				}
			});
			if(ast){
				let position = new vscode.Location(editor.document.uri, new vscode.Range(new vscode.Position(5,5), new vscode.Position(5,6)));
				/*
				_.each(ast.body, item => {
					switch(item.type){
						case "VariableDeclaration":
							_.each(item.declarations, item2 => {
								if(item2.type == "VariableDeclarator"){
									if(item2.id){
										if(item2.id.type == "Identifier"){
											let name = item2.id.name,
												kind = vscode.SymbolKind.Variable;
											let symbol = null,
												symbolNode = null;
											

											//判断值类型
											switch(item2.init.type){
												case "Literal": //字面量
												case "Identifier": //变量
													kind = vscode.SymbolKind.Variable;
													break;
												case "ArrayExpression": //数组
													kind = vscode.SymbolKind.Array;
													break;
												case "ObjectExpression": //对象
													kind = vscode.SymbolKind.Object;
													symbol = new vscode.SymbolInformation(name, kind, "script", position)
													symbolNode = new SymbolNode(symbol);
													_.each(item2.init.properties, item3 => {
														if(item3.type == "Property"){
															let keyName = item3.key.name,
																keyKind = vscode.SymbolKind.Variable,
																childSymbol = null,
																childSymbolNode = null;
															switch(item3.value.type){
																case "Literal": //字面量
																case "Identifier": //变量
																	keyKind = vscode.SymbolKind.Variable;
																	break;
															}
															childSymbol = new vscode.SymbolInformation(keyName, keyKind, name, position)
															childSymbolNode = new SymbolNode(childSymbol);
															symbolNode.addChild(childSymbolNode);
														}
													});
													break;
												case "FunctionExpression": //函数
													kind = vscode.SymbolKind.Function;
													break;
											}
											
											if(!symbolNode){
												symbol = new vscode.SymbolInformation(name, kind, "script", position)
												symbolNode = new SymbolNode(symbol);
											}
											scriptSymbolNode && scriptSymbolNode.addChild(symbolNode);
										}
									}
								}
							});
							break;
						case "ExportDefaultDeclaration":
							if(item.declaration){
								switch(item.declaration.type){
									case "ObjectExpression":
										let kind = vscode.SymbolKind.Object;
										let symbol = new vscode.SymbolInformation("export.default", kind, "script", position)
										let symbolNode = new SymbolNode(symbol);

										_.each(item.declaration.properties, item2 => {
											if(item2.type == "Property"){
												let keyName = item2.key.name,
													keyKind = vscode.SymbolKind.Variable,
													childSymbol = null,
													childSymbolNode = null;
												switch(item2.value.type){
													case "Literal": //字面量
													case "Identifier": //变量
														keyKind = vscode.SymbolKind.Variable;
														break;
												}
												childSymbol = new vscode.SymbolInformation(keyName, keyKind, name, position)
												childSymbolNode = new SymbolNode(childSymbol);
												symbolNode.addChild(childSymbolNode);
											}
										});


										scriptSymbolNode && scriptSymbolNode.addChild(symbolNode);

								}
							}
							break;
					}
				});
				*/

				declarationParser(ast.body, parentNode);

				function declarationParser (arr, parentNode) {
					arr = arr || [];
					_.each(arr, item => {
						//console.log("item.type: ", item.type);
						//console.log(item)
						switch(item.type){
							case "VariableDeclaration":
								//console.log(item.kind) // "var" | "let" | "const"
								declaratorParser(item.declarations, parentNode);
								break;
							case "FunctionDeclaration":
								//expressionOrValueParser(item, parentNode);
								let name = idOrKeyOrParamParser(item.id);
								let kind = vscode.SymbolKind.Function;
								let node = null;
								if(name && kind && parentNode){
									node = new SymbolNode(new vscode.SymbolInformation(name, kind, parentNode.symbol.name, position));
									bodyParser(item.body, node);
									parentNode.addChild(node);
								}
								break;
							case "ClassDeclaration":
								break;
							case "ImportDeclaration":
								specifiersParser(item.specifiers, parentNode);
								break;
							case "ExportDefaultDeclaration":
								break;
							case "ExportNamedDeclaration":
								break;
							case "ExportAllDeclaration":
								break;
							
							case "BlockStatement":
								break;
							case "ExpressionStatement":
								break;
							case "ReturnStatement":
								break;
						}
					});
				}

				function declaratorParser (arr, parentNode) {
					arr = arr || [];
					_.each(arr, item => {
						let name = "", 
							kind = "", 
							node = null;
						switch(item.type){
							case "VariableDeclarator":
								name = idOrKeyOrParamParser(item.id);
								kind = expressionOrValueParser(item.init);
						}
						if(name && kind && parentNode){
							node = new SymbolNode(new vscode.SymbolInformation(name, kind, parentNode.symbol.name, position));
							expressionOrValueParser(item.init, node);
							parentNode.addChild(node);
						}
					});
				}

				function idOrKeyOrParamParser (obj) {
					obj = obj || {};
					let name = "";
					switch(obj.type){
						case "Identifier":
							name = obj.name;
							break;
						case "AssignmentPattern":
							name = idOrKeyOrParamParser(obj.left);
							//obj.right
					}
					return name;
				}

				function expressionOrValueParser (obj, parentNode) {
					obj = obj || {};
					let kind = vscode.SymbolKind.Variable;
					switch(obj.type){
						case "Literal":
							//obj.value
							//obj.raw
							break;
						case "Identifier":
							//obj.name
							break;
						case "ArrayExpression":
							//obj.elements
							kind = vscode.SymbolKind.Array;
							break;
						case "ObjectExpression":
							kind = vscode.SymbolKind.Object;
							if(parentNode){
								propertyParser(obj.properties, parentNode);
							}
							break;
						case "FunctionExpression":
							//let name = idOrKeyOrParamParser(item.id);
							//let params = paramsParser(item.params);
							//bodyParser(item.body);
							kind = vscode.SymbolKind.Function;
							if(parentNode){
								bodyParser(obj.body, parentNode);
							}
							break;
					}
					return kind;
				}

				function propertyParser (arr, parentNode) {
					arr = arr || [];
					_.each(arr, item => {
						let name = "",
							kind = vscode.SymbolKind.Variable,
							node = null;
						switch(item.type){
							case "Property":
								name = idOrKeyOrParamParser(item.key);
								kind = expressionOrValueParser(item.value);
						}
						if(name && kind && parentNode){
							node = new SymbolNode(new vscode.SymbolInformation(name, kind, parentNode.symbol.name, position));
							expressionOrValueParser(item.value, node);
							parentNode.addChild(node);
						}
					});
				}

				function paramsParser (arr) {
					arr = arr || [];
					let names = [];
					_.each(arr, item => {
						let name =idOrKeyOrParamParser(item);
						names.push(name);
					});
					return names;
				}

				function bodyParser (obj, parentNode) {
					obj = obj || {};
					switch(obj.type){
						case "BlockStatement":
							declarationParser(obj.body, parentNode);
					}
				}
				
				function specifiersParser (arr, parentNode) {
					arr = arr || [];
					_.each(arr, item => {
						let name = "",
							kind = vscode.SymbolKind.Module,
							node = null;
						switch(item.type){
							case "ImportDefaultSpecifier":
							case "ImportNamespaceSpecifier":
								name = idOrKeyOrParamParser(item.local);
								break;
							case "ImportSpecifier":
								name = idOrKeyOrParamParser(item.imported);
								kind = vscode.SymbolKind.Variable;
								break;
						}
						if(name && kind && parentNode){
							node = new SymbolNode(new vscode.SymbolInformation(name, kind, parentNode.symbol.name, position));
							parentNode.addChild(node);
						}
					});
				}
				console.log(ast.body)
			}
		}console.log(tree)
		this.tree = tree;
	}


}

class SymbolOutlineProvider {

    constructor(context) {
		const treeDataProvider = new SymbolOutlineTreeDataProvider(context);
		this.symbolViewer = vscode.window.createTreeView("vueView", {
			treeDataProvider
		});

		vscode.commands.registerCommand("vueView.refresh", () => {treeDataProvider.refresh();});
		vscode.commands.registerCommand(
			"vueView.revealRange",
			(editor, range) => {
				editor.revealRange(range, vscode.TextEditorRevealType.Default);
				editor.selection = new vscode.Selection(range.start, range.start);
				vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
			}
		);
		vscode.window.onDidChangeActiveTextEditor(editor => treeDataProvider.refresh());
		vscode.workspace.onDidCloseTextDocument(document => treeDataProvider.refresh());
		vscode.workspace.onDidChangeTextDocument(event => treeDataProvider.refresh());
		vscode.workspace.onDidSaveTextDocument(document => treeDataProvider.refresh());
		vscode.commands.registerTextEditorCommand(
			"vueView.revealCurrentSymbol",
			(editor) => {
				if(editor.selections.length){
					const node = treeDataProvider.getNodeByPosition(editor.selections[0].active);
					if(node){
						this.symbolViewer.reveal(node);
					}
				}
			}
		);

	}
	
}





function readOpts() {
	let opts = vscode.workspace.getConfiguration("vueView");
	optsDoSort = opts.get("doSort");
	optsExpandNodes = convertEnumNames(opts.get("expandNodes"));
	optsSortOrder = convertEnumNames(opts.get("sortOrder"));
	optsTopLevel = convertEnumNames(opts.get("topLevel"));
}

function convertEnumNames(names) {
	return names.map(str => {
		let v = vscode.SymbolKind[str];
		return typeof v == "undefined" ? -1 : v;
	});
}


exports.SymbolOutlineProvider = SymbolOutlineProvider;