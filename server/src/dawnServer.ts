"use strict";

import {
	CancellationToken,
	CompletionItem,
	CompletionItemKind,
	CompletionList,
	CompletionParams,
	createConnection,
	Diagnostic,
	DiagnosticSeverity,
	HandlerResult,
	Range,
	ResultProgressReporter,
	SemanticTokensBuilder,
	SemanticTokensParams,
	TextDocuments,
	TextDocumentSyncKind,
	WorkDoneProgressReporter,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { vars } from "./definitionFInder";
import { IParsedToken, tokenModifiers, tokenTypes } from "./semanticTokens";

const connection = createConnection();

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
documents.listen(connection);

interface Framework {
	[index: string]: string[];
}

let framework: Framework;

connection.onInitialize(() => {
	return {
		capabilities: {
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: [".", ","],
			},
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental,
			},
		},
	};
});

function validate(document: TextDocument): void {
	connection.sendDiagnostics({
		uri: document.uri,
		version: document.version,
		diagnostics: [
			Diagnostic.create(
				Range.create(0, 0, 0, 10),
				"Something is wrong here",
				DiagnosticSeverity.Warning
			),
		],
	});
}

documents.onDidOpen((event) => {
	validate(event.document);
});

documents.onDidChangeContent((event) => {
	validate(event.document);
});

connection.onNotification("dawn/framework", (params: Framework) => {
	framework = params;
});

connection.onCompletion(
	(
		params: CompletionParams,
		_token: CancellationToken,
		_workDoneProgress: WorkDoneProgressReporter,
		_resultProgress?: ResultProgressReporter<CompletionItem[]> | undefined
	): HandlerResult<
		CompletionList | CompletionItem[] | null | undefined,
		void
	> => {
		const completions: CompletionList = CompletionList.create();
		const document = documents.get(params.textDocument.uri);

		if (!document) {
			return;
		}

		const variables = vars(document.getText());

		for (let i = 0; i < framework.funcs.length; i++) {
			const func = framework.funcs[i];
			const item = CompletionItem.create(func);

			item.kind = CompletionItemKind.Function;
		}

		for (let j = 0; j < variables.length; j++) {
			const variable = variables[j];

			const item = CompletionItem.create(variable);

			item.kind = CompletionItemKind.Variable;
		}

		for (let j = 0; j < framework.vars.length; j++) {
			const variable = framework.vars[j];

			const item = CompletionItem.create(variable);

			item.kind = CompletionItemKind.Constant;
		}

		for (let j = 0; j < framework.keywordOther.length; j++) {
			const keyword = framework.keywordOther[j];

			const item = CompletionItem.create(keyword);

			item.kind = CompletionItemKind.Keyword;
		}

		return new Promise(
			(
				resolve: (
					value:
						| CompletionItem[]
						| CompletionList
						| PromiseLike<CompletionItem[] | CompletionList | null | undefined>
						| null
						| undefined
				) => void,
				_reject: (reason?: any) => void
			) => {
				const completionsList = [...new Set(completions.items)];
				resolve(completionsList);
			}
		);
	}
);

connection.onCompletionResolve(
	(
		params: CompletionItem,
		_token: CancellationToken
	): HandlerResult<CompletionItem, void> => {
		const item = params;

		if (item.kind === CompletionItemKind.Function) {
			item.detail = `fn ${item.label}`;
		}

		if (item.kind === CompletionItemKind.Variable) {
			item.detail = `let ${item.label}`;
		}
		if (item.kind === CompletionItemKind.Constant) {
			item.detail = `const ($)! ${item.label}`;
		}

		return item;
	}
);

connection.onRequest(
	"textDocument/semanticTokens/full",
	async (params: SemanticTokensParams) => {
		const document = documents.get(params.textDocument.uri);

		if (!document) {
			return;
		}

		const allTokens = await parseText(document.getText());

		const builder = new SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(
				token.line,
				token.startCharacter,
				token.length,
				encodeTokenType(token.tokenType),
				encodeTokenModifiers(token.tokenModifiers)
			);
		});
		return builder.build();

		function encodeTokenType(tokenType: string): number {
			if (tokenTypes.has(tokenType)) {
				return tokenTypes.get(tokenType)!;
			} else if (tokenType === "notInLegend") {
				return tokenTypes.size + 2;
			}
			return 0;
		}

		function encodeTokenModifiers(strTokenModifiers: string[]): number {
			let result = 0;
			for (let i = 0; i < strTokenModifiers.length; i++) {
				const tokenModifier = strTokenModifiers[i];
				if (tokenModifiers.has(tokenModifier)) {
					result = result | (1 << tokenModifiers.get(tokenModifier)!);
				} else if (tokenModifier === "notInLegend") {
					result = result | (1 << (tokenModifiers.size + 2));
				}
			}
			return result;
		}

		async function parseText(text: string): Promise<IParsedToken[]> {
			const r: IParsedToken[] = [];
			const lines = text.split(/\r\n|\r|\n/);
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				let currentOffset = 0;

				for (let j = 0; j < line.split(" ").length; j++) {
					const openOffset = currentOffset;
					const closeOffset = line.indexOf(" ", openOffset + 1);

					let tokenData;

					if (closeOffset === -1) {
						tokenData = await parseTextToken(line.substring(openOffset), text);

						r.push({
							line: i,
							startCharacter: openOffset,
							length: line.length,
							tokenType: tokenData.tokenType,
							tokenModifiers: tokenData.tokenModifiers,
						});
					} else {
						tokenData = await parseTextToken(
							line.substring(openOffset, closeOffset),
							text
						);

						currentOffset = closeOffset;

						r.push({
							line: i,
							startCharacter: openOffset,
							length: closeOffset - openOffset,
							tokenType: tokenData.tokenType,
							tokenModifiers: tokenData.tokenModifiers,
						});
					}
				}
			}
			return r;
		}

		async function parseTextToken(
			word: string,
			ctx: string
		): Promise<{ tokenType: string; tokenModifiers: string[] }> {
			const variables = vars(ctx);

			let text = word.trim();
			text = text.replace("(", "");
			text = text.replace(")", "");

			if (text === "=") {
				return {
					tokenType: "operator",
					tokenModifiers: [],
				};
			}

			if (text === "forever" || text === "scope") {
				return {
					tokenType: "keyword",
					tokenModifiers: [],
				};
			}

			if (framework.funcs.includes(text)) {
				return {
					tokenType: "function",
					tokenModifiers: [],
				};
			}

			if (variables.includes(text)) {
				return {
					tokenType: "variable",
					tokenModifiers: [],
				};
			}

			if (framework.vars.includes(text)) {
				return {
					tokenType: "variable",
					tokenModifiers: ["readonly"],
				};
			}

			if (framework.keywordOther.includes(text)) {
				return {
					tokenType: "keywordOther",
					tokenModifiers: [],
				};
			}

			return {
				tokenType: "label",
				tokenModifiers: [],
			};
		}
	}
);

connection.listen();
