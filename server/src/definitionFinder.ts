export function vars(text: string): string[] {
	const pattern = /let\s+(.+)\s+=\s+.+/g;
	const variables: string[] = [];

	let m;
	while ((m = pattern.exec(text)) !== null) {
		let variable = m[1];
		variables.push(variable.trim());
	}

	return variables;
}
