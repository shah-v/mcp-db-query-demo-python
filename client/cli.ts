import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as readline from "readline";

// Set up readline to read from the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to prompt the user for a query
function askQuery() {
  rl.question("Enter your query (or 'exit' to quit): ", async (query) => {
    if (query.toLowerCase() === "exit") {
      console.log("Goodbye!");
      rl.close();
      return;
    }

    // Connect to the MCP server and send the query
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["ts-node", "server/server.ts"],
    });
    const client = new Client({ name: "cli-client", version: "1.0.0" });
    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: "query_database",
        arguments: { query },
      });
      const content = result.content as { type: string; text: string }[];
      console.log("Response:", content[0].text);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      await client.close();
      askQuery(); // Ask for the next query
    }
  });
}

// Start the CLI
console.log("Welcome to the Farming Database CLI!");
askQuery();