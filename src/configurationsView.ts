import * as vscode from 'vscode';

interface LooseObject {
	[key: string]: any
}

class StorageSettings {
	folder?: string;
	global?: string;
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

/// Return:
///     [undefined, undefined] - store in workspace file (for a multi-root workspace), or in settings.json (for a simple workspace)
///     [undefined, vscode.Uri("<path>/.vscode/settings.json")] - store in the settings of one of the folders of multi-root workspace
///     ["someFolder", undefined] - store in global user settings
function getSelectedOptionsStore(): readonly [string | undefined, vscode.Uri | undefined] {
	let configStore = vscode.workspace.getConfiguration("launchOption").get<StorageSettings>("store");
	let configFolder = configStore && configStore["folder"];
	let configGlobal = configStore && configStore["global"];

	// store config in global user settings
	if (configGlobal) {
		return [configGlobal, undefined];
	}

	// multi-root workspace: store config in folder settings
	if (vscode.workspace.workspaceFolders && configFolder) {
		for (let ws of vscode.workspace.workspaceFolders) {
			if (ws.name === configFolder) {
				return [undefined, ws.uri];
			}
		}
	}

	// store config in workspace file
	return [undefined, undefined];
}

function getSelectedOptions(): LooseObject | undefined {
	let [storeGlobal, storeFolder] = getSelectedOptionsStore();
	if (storeGlobal !== undefined && storeGlobal !== "") {
		let globalConfig = vscode.workspace.getConfiguration("launchOption").get<LooseObject>("globalConfig", {});

		if (globalConfig !== undefined && storeGlobal in globalConfig) {
			return globalConfig[storeGlobal];
		} else {
			return {};
		}
	}

	return vscode.workspace.getConfiguration("launchOption", storeFolder).get<LooseObject>("currentConfig", {});
}

function setSelectedOptions(config: LooseObject | undefined) {
	let [storeGlobal, storeFolder] = getSelectedOptionsStore();

	if (storeGlobal !== undefined && storeGlobal !== "") {
		let globalConfig = vscode.workspace.getConfiguration("launchOption").get<LooseObject>("globalConfig");
		if (globalConfig !== undefined) {
			globalConfig[storeGlobal] = config;
		}
		vscode.workspace.getConfiguration("launchOption").update("globalConfig", globalConfig, vscode.ConfigurationTarget.Global);
		return;
	}

	if (storeFolder !== undefined) {
		vscode.workspace.getConfiguration("launchOption", storeFolder).update("currentConfig", config, vscode.ConfigurationTarget.WorkspaceFolder);
		return;
	}

	vscode.workspace.getConfiguration("launchOption").update("currentConfig", config, vscode.ConfigurationTarget.Workspace);
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
		let currentOptions = getSelectedOptions();
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
				currentOptions[key] = currentValue.value;
			}
		}

		setSelectedOptions(currentOptions);
		this._onDidChangeTreeData.fire(null);
	}

    getTreeItem(element: ConfigOption): vscode.TreeItem {
		element.command = { command: 'launchOption.chooseOption', title: "Choose Option", arguments: [element, this], };
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

    public changeConfigParam(provider: ConfigViewProvider) {

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
				let config = getSelectedOptions();
				if (config != undefined)
					config[this.label] = this.value.value;
				setSelectedOptions(config);
			}
			this.tooltip = `${this.label}-${this.value.name}`;
			this.description = this.value.name == "" ? EmptyRow : this.value.name;
		});
    }
}