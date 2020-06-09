// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ConfigViewProvider, ConfigTreeOptions, ConfigOption, SelectConfigEvent } from './configurationsView';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	let configurationsViewProvider = new ConfigViewProvider();
	vscode.window.registerTreeDataProvider('launchOption', configurationsViewProvider);

	let treeView = vscode.window.createTreeView('launchOption', new ConfigTreeOptions(configurationsViewProvider));
	treeView.onDidChangeSelection((evt: SelectConfigEvent) => {
		if (evt.selection.length == 0)
			return;
		evt.selection[0].changeConfigParam(configurationsViewProvider, context);
	});

	vscode.workspace.onDidChangeConfiguration(event => {
		let affected = event.affectsConfiguration("launchOption.options");
        if (affected) {
            configurationsViewProvider.updateOptions();
        }
    })
}

// this method is called when your extension is deactivated
export function deactivate() {}
