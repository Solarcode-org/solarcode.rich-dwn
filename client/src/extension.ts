"use strict";

import * as path from "path";
import { ExtensionContext, window as Window } from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	RevealOutputChannelOn,
	ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";
import { getFramework } from "./framework";

let client: LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
	const serverModule = context.asAbsolutePath(
		path.join("server", "out", "dawnServer.js")
	);
	let serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: { cwd: process.cwd() },
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: { cwd: process.cwd() },
		},
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "dawn" }],
		diagnosticCollectionName: "dawnDiagnostics",
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		progressOnInitialization: true,
	};

	try {
		client = new LanguageClient("Dawn Client", serverOptions, clientOptions);
	} catch (err) {
		Window.showErrorMessage(
			`The extension couldn't be started. See the output channel for details.`
		);
		return;
	}
	client.registerProposedFeatures();

	client.start();

	client.sendNotification("dawn/framework", await getFramework());
}

export function deactivate() {
	if (!client) {
		return;
	}

	client.stop();
}
