import * as vscode from 'vscode';

interface LooseObject {
	[key: string]: any
}

function equal(a:any, b:any) {
  if (a === b) return true;

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (a.constructor !== b.constructor) return false;

    var length, i, keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0;)
        if (!equal(a[i], b[i])) return false;
      return true;
    }

    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0;)
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = length; i-- !== 0;) {
      var key = keys[i];
      if (!equal(a[key], b[key])) return false;
    }

    return true;
  }

  // true if both NaN, false otherwise
  return a!==a && b!==b;
};

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
						let filter = values[i].hasOwnProperty("filter") ? values[i]["filter"] : [];
						values[i] = new OptionPair(values[i]["name"], values[i]["value"], filter);
					}
					else
					{
						values[i] = new OptionPair(values[i], values[i], []);
					}
				}
				let currentValue;
				if (!currentOptions.hasOwnProperty(key))
				{
					currentValue = values[0];
				}
				else
				{
					currentValue = values[0];
					for (let i = 0; i < values.length; ++i)
					{
						if (equal(values[i].value, currentOptions[key]))
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

	getOptions() : ConfigOption[] {
		return this.options;
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

class OptionFilter {
	constructor(public name : string, public values : Array<string>) {}
}

class OptionPair {
	constructor(public name : string, public value : Object, public filters : Array<OptionFilter>) {}
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

	private genValuesToPick(provider: ConfigViewProvider) {
		let valuesToPick : Array<string> = Array<string>();
		let currentOptions : ConfigOption[] = provider.getOptions();
		for (let i = 0; i < this.values.length; ++i) {
			let filterPassed :boolean = true;
			for (let opt of currentOptions) {
				let filterIdx = this.values[i].filters.findIndex((filt: OptionFilter) => {return opt.label == filt.name;});
				let optionPassed : boolean = filterIdx == -1;
				filterPassed = filterPassed &&
				(optionPassed || this.values[i].filters[filterIdx].values.findIndex((value :string) => {return opt.value.name == value;}) != -1);
			}
			if (filterPassed) {
				valuesToPick.push(this.values[i].name.length == 0 ? EmptyRow : this.values[i].name);
			}
		}
		return valuesToPick;
	}

    public changeConfigParam(provider: ConfigViewProvider, context: vscode.ExtensionContext) {
		let valuesToPick : Array<string> = this.genValuesToPick(provider);
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