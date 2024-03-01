import * as vscode from 'vscode';

let script: string | undefined;
/**
 * Retrieves the database context and optionally includes the header.
 * @param includeHeader - Whether to include the header in the returned script. Default is true.
 * @returns The database creation script or the script with the header, if includeHeader is true.
 */
export async function getDatabaseContext(includeHeader = true) {
	const sqlExtensionApi = await vscode.extensions.getExtension('ms-mssql.mssql')?.activate();
	script ??= await sqlExtensionApi.getDatabaseCreateScript?.();
	if (!includeHeader && script) { return script; }
	return `Here are the creation scripts that were used to create the tables in my database. Pay close attention to the tables and columns that are available in my database:
${script}`;
}

/**
 * Runs a SQL query in a SQL text editor.
 * @param query The SQL query to run.
 */
export async function runQuery(query: string) {
	await Promise.race([new Promise(resolve => setTimeout(resolve, 3000)), new Promise((resolve) => {
		vscode.window.onDidChangeActiveTextEditor(resolve);
		return vscode.commands.executeCommand('mssql.newQuery');
	})]);
	await vscode.window.activeTextEditor?.edit((editBuilder) => {
		editBuilder.insert(new vscode.Position(0, 0), query);
	});
	await vscode.commands.executeCommand('mssql.runQuery');
}
