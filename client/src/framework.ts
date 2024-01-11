import { window, Uri, workspace } from "vscode";

interface Framework {
	[index: string]: string[];
}

let defaultFramework: Framework = {
	funcs: ["say", "short_say", "ask"],
	vars: ["$hello"],
	keywordOther: ["let"],
};

export async function getFramework(): Promise<Framework> {
	const fileURI = window.activeTextEditor?.document.uri;

	if (!fileURI) {
		return defaultFramework;
	}

	const frameworkPath = Uri.joinPath(fileURI, "..", "framework.fw");

	try {
		const framework = await workspace.fs.readFile(frameworkPath);
		return read(framework);
	} catch (err) {
		return defaultFramework;
	}
}

function read(data_: Uint8Array) {
	let specifier = "";
	const dataObj: {
		[key: string]: string[];
	} = {};

	let data = new TextDecoder().decode(data_);

	for (let i = 0; i < data.split(/\n|\r\n/).length; i++) {
		const line = data.split(/\n|\r\n/)[i];
		const firstWord = line.split(" ")[0].trim();

		if (specifier) {
			if (firstWord === ";") {
				specifier = "";
				continue;
			}
			dataObj[specifier].push(firstWord.trim());

			continue;
		}

		if (firstWord.endsWith(":")) {
			specifier = firstWord.substring(0, firstWord.length - 1);
			dataObj[specifier] = [];
		}
	}

	return dataObj;
}
