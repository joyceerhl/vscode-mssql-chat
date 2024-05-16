// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { getDatabaseContext, runQuery } from './utils';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Register a chat participant that can respond to user queries
	vscode.chat.createChatParticipant('vscode-mssql-chat', async (request, context, response, token) => {
		const userQuery = request.prompt;

		const lm = await vscode.lm.selectChatModels({ 'vendor': 'copilot', 'version': 'gpt-4' });
		if (!lm) {
			response.markdown('Sorry, I couldn\'t complete that request.');
			return;
		}

		const messages = [
			new vscode.LanguageModelChatMessage(vscode.LanguageModelChatMessageRole.User, 'You must return your suggested SQL query in a markdown code block that begins with ```sql and ends with ```.'),
			new vscode.LanguageModelChatMessage(vscode.LanguageModelChatMessageRole.User, await getDatabaseContext() + '\n' + userQuery)
		];

		const chatRequest = await lm[0].sendRequest(messages, {}, token);
		let query = '';
		for await (const data of chatRequest.text) {
			query += data;
			response.markdown(data);
		}

		const sqlRegex = /```([^\n])*\n([\s\S]*?)\n?```/g;
		const match = sqlRegex.exec(query);
		if (match && match[2]) {
			response.button({ command: 'vscode-mssql-chat.runQuery', title: 'Run Query', arguments: [match[2]] });
		}
	});

	// Register a command to run the SQL query from the chat response
	vscode.commands.registerCommand('vscode-mssql-chat.runQuery', (query: string) => {
		runQuery(query);
	});

	// Register a variable exposing the same context to be reused with other chat participants
	context.subscriptions.push(vscode.chat.registerChatVariableResolver('vscode-mssql-chat-database', 'database', 'The context of the user\'s database', 'The context of the user\'s database', false, {
		resolve: async (name: string, context: vscode.ChatVariableContext, token: vscode.CancellationToken) => ([{
			level: vscode.ChatVariableLevel.Full,
			value: await getDatabaseContext(false),
			description: 'Here are the creation scripts that were used to create the tables in my database. Pay close attention to the tables and columns that are available in my database.'
		}])
	}));

	// Register a command that can be invoked to get a summary of the user's database context
	context.subscriptions.push(vscode.commands.registerCommand('vscode-mssql-chat.summarizeDatabase', async () => {
		vscode.commands.executeCommand('workbench.action.chat.open', `@mssql Give me an overview of this database.`);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
