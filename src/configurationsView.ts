import * as vscode from 'vscode';

interface LooseObject {
	[key: string]: any
}

export class ConfigViewProvider implements vscode.TreeDataProvider<ConfigOption> {

	private _onDidChangeTreeData: vscode.EventEmitter<ConfigOption | null> = new vscode.EventEmitter<ConfigOption | null>();
  	readonly onDidChangeTreeData: vscode.Event<ConfigOption | null> = this._onDidChangeTreeData.event;
	private options : Array<ConfigOption> = new Array();

	constructor()
	{
		this.updateOptions();
	}

	updateOptions() {
		this.options = new Array<ConfigOption>();
		let optionsList = vscode.workspace.getConfiguration("launchOption").get<Object>("options");
		let currentOptions = vscode.workspace.getConfiguration("launchOption").get<LooseObject>("currentConfig");
		if (optionsList != undefined && currentOptions != undefined)
		{
			for (let [key, values] of Object.entries(optionsList))
			{
				if (!currentOptions.hasOwnProperty(key))
				{
					currentOptions[key] = values[0];
				}
				this.options.push(new ConfigOption(key, values, currentOptions[key]));
			}
		}
		vscode.workspace.getConfiguration("launchOption").update("currentConfig", currentOptions, vscode.ConfigurationTarget.Workspace);
		this._onDidChangeTreeData.fire(null);
	}

    getTreeItem(element: ConfigOption): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ConfigOption): Thenable<ConfigOption[]> {
        return Promise.resolve(this.options);
	}

    refresh(): void {
		this._onDidChangeTreeData.fire(null);
	}
}

export class SelectConfigEvent implements vscode.TreeViewSelectionChangeEvent<ConfigOption> {
    constructor(
		public selection : ConfigOption[]
	) {
	}
}

export class ConfigTreeOptions implements vscode.TreeViewOptions<ConfigOption> {
    constructor(
		public treeDataProvider: ConfigViewProvider
	) {
	}
}

const EmptyRow : string = "\"empty\"";

export class ConfigOption extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private values: string[],
		private value: string
	) {
        super(label, vscode.TreeItemCollapsibleState.None);
	}

	get tooltip(): string {
		return `${this.label}-${this.value}`;
	}

	get description(): string {
		return this.value == "" ? EmptyRow : this.value;
    }

    public changeConfigParam(provider: ConfigViewProvider, context: vscode.ExtensionContext) {
		let valuesToPick : Array<string> = this.values;
		for (let i = 0; i < valuesToPick.length; ++i)
			if (valuesToPick[i].length == 0)
			valuesToPick[i] = EmptyRow
        let newValue = vscode.window.showQuickPick(this.values);
        newValue.then((newVal)=>{
            if (newVal == undefined)
                return;
			this.value = newVal == EmptyRow ? "" : newVal;
			provider.refresh();
			if (vscode.workspace.workspaceFolders?.length && this.label != undefined)
			{
				let config = vscode.workspace.getConfiguration("launchOption").get<LooseObject>("currentConfig");
				if (config != undefined)
					config[this.label] = this.value;
				vscode.workspace.getConfiguration("launchOption").update("currentConfig", config, vscode.ConfigurationTarget.Workspace);
			}
        });
    }
}