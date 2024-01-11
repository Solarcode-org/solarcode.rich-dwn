import { SemanticTokensLegend } from "vscode-languageserver";

export const tokenTypes = new Map<string, number>();
export const tokenModifiers = new Map<string, number>();

export const legend = (function (): SemanticTokensLegend {
	const tokenTypesLegend = [
		"comment",
		"string",
		"keyword",
		"keywordOther",
		"number",
		"regexp",
		"operator",
		"namespace",
		"type",
		"struct",
		"class",
		"interface",
		"enum",
		"typeParameter",
		"function",
		"method",
		"decorator",
		"macro",
		"variable",
		"parameter",
		"property",
		"label",
	];
	tokenTypesLegend.forEach((tokenType, index) =>
		tokenTypes.set(tokenType, index)
	);

	const tokenModifiersLegend = [
		"declaration",
		"documentation",
		"readonly",
		"static",
		"abstract",
		"deprecated",
		"modification",
		"async",
	];
	tokenModifiersLegend.forEach((tokenModifier, index) =>
		tokenModifiers.set(tokenModifier, index)
	);

	return { tokenTypes: tokenTypesLegend, tokenModifiers: tokenModifiersLegend };
})();

export interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}
