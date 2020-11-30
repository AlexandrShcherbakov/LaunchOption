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
				for (let i = 0; i < values.length; ++i)
				{
					if ((values[i] instanceof Object))
					{
						values[i] = new OptionPair(values[i]["name"], values[i]["value"]);
					}
					else
					{
						values[i] = new OptionPair(values[i], values[i]);
					}
				}
				let currentValue;
				if (!currentOptions.hasOwnProperty(key))
				{
					currentValue = values[0];
				}
				else
				{
					for (let i = 0; i < values.length; ++i)
					{
						if (values[i].value == currentOptions[key])
						{
							currentValue = values[i];
						}
					}
				}
				this.options.push(new ConfigOption(key, values, currentValue));
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

class OptionPair {
	constructor(public name : string, public value : string) {}
}
export class ConfigOption extends vscode.TreeItem {
	tooltip : string;
	description :string;

	constructor(
		public readonly label: string,
		private values: OptionPair[],
		private value : OptionPair
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.value = value;
		this.tooltip = `${this.label}-${this.value.name}`;
		this.description = this.value.name == "" ? EmptyRow : this.value.name;
	}

    public changeConfigParam(provider: ConfigViewProvider, context: vscode.ExtensionContext) {
		let valuesToPick : Array<string> = Array<string>();
		for (let i = 0; i < this.values.length; ++i)
			valuesToPick.push(this.values[i].name.length == 0 ? EmptyRow : this.values[i].name);
		let lineValue = this.value.name == "" ? EmptyRow : this.value.name;
		valuesToPick.splice(valuesToPick.indexOf(lineValue), 1);
		valuesToPick.unshift(lineValue);
        let newValue = vscode.window.showQuickPick(valuesToPick);
        newValue.then((newVal)=>{
            if (newVal == undefined)
				return;
			var foundValue = this.values.find((pair)=>{ return pair.name == (newVal == EmptyRow ? "" : newVal);});
			if (foundValue == undefined)
				return;
			this.value = foundValue;
			provider.refresh();
			if (vscode.workspace.workspaceFolders?.length && this.label != undefined)
			{
				let config = vscode.workspace.getConfiguration("launchOption").get<LooseObject>("currentConfig");
				if (config != undefined)
					config[this.label] = this.value.value;
				vscode.workspace.getConfiguration("launchOption").update("currentConfig", config, vscode.ConfigurationTarget.Workspace);
			}
			this.tooltip = `${this.label}-${this.value.name}`;
			this.description = this.value.name == "" ? EmptyRow : this.value.name;
		});
    }
}