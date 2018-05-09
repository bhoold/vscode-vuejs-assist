const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const _ = require('lodash');



class DepNodeProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }
        return new Promise(resolve => {
            if (element) {
                resolve(this.getDepsInPackageJson(path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')));
            }
            else {
                const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
                if (this.pathExists(packageJsonPath)) {
                    resolve(this.getDepsInPackageJson(packageJsonPath));
                }
                else {
                    vscode.window.showInformationMessage('Workspace has no package.json');
                    resolve([]);
                }
            }
        });
    }
    /**
     * Given the path to package.json, read all its dependencies and devDependencies.
     */
    getDepsInPackageJson(packageJsonPath) {
        if (this.pathExists(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const toDep = (moduleName) => {
                if (this.pathExists(path.join(this.workspaceRoot, 'node_modules', moduleName))) {
                    return new Dependency(moduleName, vscode.TreeItemCollapsibleState.Collapsed);
                }
                else {
                    return new Dependency(moduleName, vscode.TreeItemCollapsibleState.None, {
                        command: 'extension.openPackageOnNpm',
                        title: '',
                        arguments: [moduleName],
                    });
                }
            };
            const deps = packageJson.dependencies
                ? Object.keys(packageJson.dependencies).map(toDep)
                : [];
            const devDeps = packageJson.devDependencies
                ? Object.keys(packageJson.devDependencies).map(toDep)
				: [];
				console.log(deps.concat(devDeps))
            return deps.concat(devDeps);
        }
        else {
            return [];
        }
    }
    pathExists(p) {
        try {
            fs.accessSync(p);
        }
        catch (err) {
            return false;
        }
        return true;
    }
}
exports.DepNodeProvider = DepNodeProvider;
class Dependency extends vscode.TreeItem {
    constructor(label, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
        };
		this.contextValue = 'dependency';
    }
}


exports.DepNodeProvider = DepNodeProvider;