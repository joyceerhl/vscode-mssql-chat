// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { getDatabaseContext, runQuery } from './utils';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Register a chat participant that can respond to user queries
	const participant = vscode.chat.createChatParticipant('vscode-mssql-chat', async (request: vscode.ChatRequest, context: vscode.ChatContext, response: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
		response.progress('Reading database context...');

		const userMessage = await generateUserPrompt(request.prompt);
		const messages = [
			new vscode.LanguageModelChatMessage(vscode.LanguageModelChatMessageRole.User, generateSystemPrompt()),
			new vscode.LanguageModelChatMessage(vscode.LanguageModelChatMessageRole.User, userMessage),
		];

		const lm = await vscode.lm.selectChatModels({ family: 'gpt-4', vendor: 'copilot' });
		if (!lm) {
			response.markdown('Sorry, I am unable to respond to your request at this time.');
			return {};
		}

		const chatRequest = await lm?.[0].sendRequest(messages, {}, token);

		let data = '';
		for await (const part of chatRequest.stream) {
			data += part;
			response.markdown(part);
		}

		const regex = /```([^\n])*\n([\s\S]*?)\n?```/g;
		const match = regex.exec(data);
		const query = match ? match[2] : '';
		if (query) {
			response.button({ title: 'Run Query', command: 'vscode-mssql-chat.runQuery', arguments: [query] });
		}

		return {};
	});

	context.subscriptions.push(participant);

	// Register a command to run the SQL query from the chat response
	context.subscriptions.push(vscode.commands.registerCommand('vscode-mssql-chat.runQuery', async (query: string) => {
		runQuery(query);
	}));

	// Register a variable exposing the same context to be reused with other chat participants
	context.subscriptions.push(vscode.chat.registerChatVariableResolver('database', 'The context of the user\'s database', {
		resolve: async (name: string, context: vscode.ChatVariableContext, token: vscode.CancellationToken) => ([{
			level: vscode.ChatVariableLevel.Full,
			value: await getDatabaseContext(false),
			description: 'Here are the creation scripts that were used to create the tables in my database. Pay close attention to the tables and columns that are available in my database.'
		}])
	}));

	// Register a command that can be invoked to get a summary of the user's database context
	// This will be integrated into the tree item context menu in the SQL Server view
	// and will submit a request to the chat participant to provide a summary of the user's database
	context.subscriptions.push(vscode.commands.registerCommand('vscode-mssql-chat.summarizeDatabase', async () => {
		vscode.commands.executeCommand('workbench.action.chat.open', `@mssql Give me an overview of this database.`);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }

function generateSystemPrompt() {
	return `
You are an expert in Microsoft SQL Server, Azure SQL Database, and writing T-SQL queries.
Your job is to help the user write readable and performant SQL queries.
Pay close attention to the provided context about the user's database and the desired output.
Provide your suggested SQL query inside a Markdown code block that starts with \`\`\`sql and ends with \`\`\`.`;
}

async function generateUserPrompt(userQuery: string): Promise<string> {
	return `
SQL query description: ${userQuery}
Database context: ${await getDatabaseContext()}`;
}
