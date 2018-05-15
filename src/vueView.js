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
			await this.updateSymbolsByParser2(vscode.window.activeTextEditor);
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
		let collapsibleState;
		let treeItem;
		
		if(element.children.length){
			collapsibleState =
				optsExpandNodes.length && SymbolNode.shouldAutoExpand(kind)
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.Collapsed;
		}else{
			collapsibleState = vscode.TreeItemCollapsibleState.None;
		}

		treeItem = new vscode.TreeItem(element.symbol.name, collapsibleState);

		treeItem.command = {
			command: "vueView.revealRange",
			title: "",
			arguments: [this.editor, element.symbol.location.range]
		};

		treeItem.iconPath = icons.getIcon(kind, this.context);

		//treeItem.tooltip = "sdfgsdf";
		return treeItem;
	}

	//刷新vue view
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
			}

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


	async updateSymbolsByParser2 (editor) {
		const tree = new SymbolNode();
		const oldTree = this.tree || tree;

		this.editor = editor;
		if(editor && editor.document.languageId == "vue"){
			readOpts();
			let symbols = await this.getSymbols(editor.document);
			if (optsTopLevel.indexOf(-1) < 0) {
				symbols = symbols.filter(sym => optsTopLevel.indexOf(sym.kind) >= 0);
			}

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

			let parentNode = null;
			_.each(tree.children, item => {
				if(item.symbol.name == "script"){
					parentNode = item;
					item.children = [];
					return false;
				}
			});
			if(parentNode == null){
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
							ranges: true,
							locations: true,
							ecmaVersion: 9
						});
					}catch(e){
						console.log(e)
					}
					return false;
				}
			});
			if(ast){
				declarationParser(ast.body, parentNode);

				function declarationParser (arr, parentNode) {
					arr = arr || [];
					_.each(arr, item => {
						//console.log(item)

						switch(item.type){
							case "FunctionDeclaration":
								let kind = vscode.SymbolKind.Function;
								let isAsync = item.async;
								let name = getName(item.id);
								let param = getParams(item.params);
								let returnVal = getReturnVal(item.body);
								let position = new vscode.Location(editor.document.uri, new vscode.Range(new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.start.line, item.loc.start.column), new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.end.line, item.loc.end.column)));
								let symbName = (isAsync ? "[async] " : "") + `${name} (${param})` + (returnVal == "void" ? "" : `: ${returnVal}`);
								let node = new SymbolNode(new vscode.SymbolInformation(symbName, kind, parentNode.symbol.name, position));
								//bodyParser(item.body, node);
								parentNode.addChild(node);
								break;
						}
					});
				}

				function getName (obj) {
					obj = obj || {};
					let name = "";
					switch(obj.type){
						case "Literal":
							name = obj.value;
							break;
						case "Identifier":
							name = obj.name;
							break;
						case "AssignmentPattern":
							name = getName(obj.left);
							//obj.right
					}
					return name;
				}

				function getParams (arr) {
					arr = arr || [];
					let params = [];
					_.each(arr, item => {
						switch(item.type){
							case "Identifier":
								params.push(item.name);
								break;
						}
					});
					return params.join(", ");
				}

				function getReturnVal (obj) {
					obj = obj || {};
					let value = "";
					let voidVal = "[void]";
					let multipleVal = "[multiple]";
					let reStaArr = retStatementParser(obj);
					if(reStaArr.length == 1){
						value = "[" + getExpressionKind(reStaArr[0]) + "]";
					}else if(reStaArr.length > 1){
						value = multipleVal;
					}else{
						value = voidVal;
					}
					return value;
				}

				function getExpressionKind (obj) {
					obj = obj || {};
					let kind = "unknow";
					switch(obj.type){
						case "Literal":
							kind = "Literal";
							break;
						case "Identifier":
							kind = "Identifier"
							break;
						case "ArrayExpression":
							kind = "Array";
							break;
						case "ObjectExpression":
							kind = "Object";
							break;
						case "FunctionExpression":
							kind = "Function";
							break;
					}
					return kind;
				}

				function retStatementParser (obj) {
					obj = obj || {};
					let reStaArr = [];

					function statementParser (arr) {
						arr = arr || [];

						let reStaArr = [];
						_.each(arr, item => {
							switch(item.type){
								case "ReturnStatement":
									reStaArr.push(item.argument);
									break;
								case "IfStatement":
									Array.prototype.push.apply(reStaArr, retStatementParser(item.consequent));
									Array.prototype.push.apply(reStaArr, retStatementParser(item.alternate));
									break;
								case "SwitchStatement":
									_.each(item.cases, caseItem => {
										Array.prototype.push.apply(reStaArr, statementParser(caseItem.consequent));
									});
									break;
								case "TryStatement":
									Array.prototype.push.apply(reStaArr, retStatementParser(item.block));
									Array.prototype.push.apply(reStaArr, retStatementParser(item.handler.body));
									Array.prototype.push.apply(reStaArr, retStatementParser(item.finalizer));
									break;
								case "WhileStatement":
								case "DoWhileStatement":
								case "ForStatement":
								case "ForInStatement":
									Array.prototype.push.apply(reStaArr, retStatementParser(item.body));
									break;
							}
						});
						return reStaArr;
					}

					switch(obj.type){
						case "BlockStatement":
							reStaArr = statementParser(obj.body);
							break;
					}
					return reStaArr;
				}

				function bodyParser (obj, parentNode) {
					obj = obj || {};
					switch(obj.type){
						case "BlockStatement":
							declarationParser(obj.body, parentNode);
							break;
						case "ClassBody":
							//propertyOrClassBodyParser(obj.body, parentNode);
							break;
					}
				}
			}
		}
		if(tree.children.length){
			if (optsDoSort) {
				tree.sort();
			}
			this.tree = tree;
		}else{
			this.tree = oldTree;
		}
		
	}




	//使用acorn解析script内容
	async updateSymbolsByParser (editor) {
		const tree = new SymbolNode();
		const oldTree = this.tree || tree;

		this.editor = editor;
		if(editor && editor.document.languageId == "vue"){
			readOpts();
			let symbols = await this.getSymbols(editor.document);
			if (optsTopLevel.indexOf(-1) < 0) {
				symbols = symbols.filter(sym => optsTopLevel.indexOf(sym.kind) >= 0);
			}

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

			let parentNode = null;
			_.each(tree.children, item => {
				if(item.symbol.name == "script"){
					parentNode = item;
					item.children = [];
					return false;
				}
			});
			if(parentNode == null){
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
							ranges: true,
							locations: true,
							ecmaVersion: 9
						});
					}catch(e){
						console.log(e)
					}
					return false;
				}
			});
			if(ast){
				declarationParser(ast.body, parentNode);

				function declarationParser (arr, parentNode, nameForExport) {
					arr = arr || [];
					_.each(arr, item => {
						let name = "";
						let kind = "";
						let node = null;
						switch(item.type){
							case "VariableDeclaration":
								//console.log(item.kind) // "var" | "let" | "const"
								declaratorParser(item.declarations, parentNode, nameForExport);
								break;
							case "FunctionDeclaration":
								name = idOrKeyOrParamParser(item.id);
								if(nameForExport && nameForExport.indexOf("${name}") >= 0){
									name = nameForExport.replace("${name}", name);
								}
								kind = vscode.SymbolKind.Function;
								break;
							case "ClassDeclaration":
								//item.superClass
								name = idOrKeyOrParamParser(item.id);
								if(nameForExport && nameForExport.indexOf("${name}") >= 0){
									name = nameForExport.replace("${name}", name);
								}
								kind = vscode.SymbolKind.Class;
								break;

							case "ImportDeclaration":
								specifiersParser(item.specifiers, parentNode);
								break;
							case "ExportDefaultDeclaration":
								name = "export.default";
								kind = expressionOrValueParser(item.declaration)
								break;
							case "ExportNamedDeclaration":
								declarationParser([item.declaration], parentNode, "export.${name}");
								break;
							case "ExportAllDeclaration":
								break;
							
							case "ExpressionStatement":
								expressionOrValueParser(item.expression, parentNode);
								break;
							case "ReturnStatement":
								expressionOrValueParser(item.argument, parentNode);
								break;
						}
						if(name && kind && parentNode){
							let position = new vscode.Location(editor.document.uri, new vscode.Range(new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.start.line, item.loc.start.column), new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.end.line, item.loc.end.column)));
							node = new SymbolNode(new vscode.SymbolInformation(name, kind, parentNode.symbol.name, position));
							if(item.body){
								bodyParser(item.body, node);
							}else if(item.declaration){
								expressionOrValueParser(item.declaration, node);
							}
							parentNode.addChild(node);
						}
					});
				}

				function declaratorParser (arr, parentNode, nameForExport) {
					arr = arr || [];
					_.each(arr, item => {
						let name = "", 
							kind = "", 
							node = null;
						switch(item.type){
							case "VariableDeclarator":
								name = idOrKeyOrParamParser(item.id);
								if(nameForExport && nameForExport.indexOf("${name}") >= 0){
									name = nameForExport.replace("${name}", name);
								}
								kind = expressionOrValueParser(item.init);
						}
						if(name && kind && parentNode){
							let position = new vscode.Location(editor.document.uri, new vscode.Range(new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.start.line, item.loc.start.column), new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.end.line, item.loc.start.column)));
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
						case "Literal":
							name = obj.value;
							break;
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
								propertyOrClassBodyParser(obj.properties, parentNode);
							}
							break;
						case "FunctionExpression":
							//let name = idOrKeyOrParamParser(item.id);
							//let params = paramsParser(item.params);
							//bodyParser(item.body);
							kind = vscode.SymbolKind.Function;
							if(parentNode){
								/*
								if(!name){
									name = "<function>";
									if(obj.id){
										name = idOrKeyOrParamParser(obj.id);
									}
									let node = new SymbolNode(new vscode.SymbolInformation(name, kind, parentNode.symbol.name, position));
									parentNode.addChild(node);
									parentNode = node;
								}*/
								bodyParser(obj.body, parentNode);
							}
							break;
						case "CallExpression":
							
							expressionOrValueParser(obj.callee, parentNode);
							//console.log(obj)
							break;
					}
					return kind;
				}

				function propertyOrClassBodyParser (arr, parentNode) {
					arr = arr || [];
					_.each(arr, item => {
						let name = "",
							kind = vscode.SymbolKind.Variable,
							node = null;
						switch(item.type){
							case "Property":
								name = idOrKeyOrParamParser(item.key);
								kind = expressionOrValueParser(item.value);
							case "MethodDefinition":
								name = idOrKeyOrParamParser(item.key);
								kind = expressionOrValueParser(item.value);
						}
						if(name && kind && parentNode){
							let position = new vscode.Location(editor.document.uri, new vscode.Range(new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.start.line, item.loc.start.column), new vscode.Position(scriptSymbol.location.range.end.line - 1 + item.loc.end.line, item.loc.start.column)));
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
							break;
						case "ClassBody":
							propertyOrClassBodyParser(obj.body, parentNode);
							break;
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
							let position = new vscode.Location(editor.document.uri, new vscode.Range(new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.start.line, item.loc.start.column), new vscode.Position(scriptSymbol.location.range.start.line - 1 + item.loc.end.line, item.loc.start.column)));
							node = new SymbolNode(new vscode.SymbolInformation(name, kind, parentNode.symbol.name, position));
							parentNode.addChild(node);
						}
					});
				}
				//console.log(ast.body)
			}
		}
		if(tree.children.length){
			if (optsDoSort) {
				tree.sort();
			}
			this.tree = tree;
		}else{
			this.tree = oldTree;
		}
		
	}



	//根据光标位置在vue view中显示节点
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