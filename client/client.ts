import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testQueryDatabase(query: string) {
  // Set up the transport to talk to server.ts
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["ts-node", "server/server.ts"], // This runs your server
  });

  // Create a client to send requests
  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  try {
    // Connect to the server
    await client.connect(transport);

    // Send a query to the query_database tool
    const result = await client.callTool({
      name: "query_database",
      arguments: { query },
    });

    // Show the response
    const content = result.content as { type: string; text: string }[];
    console.log(`Query: "${query}"\nResponse:`, content[0].text);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Clean up by closing the client
    if (typeof client.close === "function") {
      await client.close();
    }
  }
}

// Some test queries to try out
const testQueries = [
  "how many farms",
  "list all farms",
  "crops in Green Acres",
  "tell me about Sunny Fields",
  "which farms grow wheat",
  "what's the weather like", // This one’s unsupported, so we can test the error message
];

// Run all the test queries
(async () => {
  for (const query of testQueries) {
    await testQueryDatabase(query);
  }
})();