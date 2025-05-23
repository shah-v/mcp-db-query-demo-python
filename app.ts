import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { spawn } from 'child_process';

const QueryToolSchema = z.object({
    content: z.array(z.object({ text: z.string() })),
    isError: z.boolean().optional()
  });

const app = express();
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('.')); // Serve static files like index.html

// Spawn the MCP server subprocess once at startup
const mcpProcess = spawn('npx', ['ts-node', 'mcp-server.ts'], {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
});

// Create the transport and client
const transport = new StdioClientTransport({
  command: "npx",
  args: ["ts-node", "mcp-server.ts"]
});
const client = new Client({ name: 'web-client', version: '1.0.0' });

// Connect the client to the MCP server (do this once)
client.connect(transport).then(() => {
  console.log('Connected to MCP server');
}).catch((error) => {
  console.error('Failed to connect to MCP server:', error);
});

// Handle /api/query requests using the persistent client
app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  try {
      const resultRaw = await client.callTool({
          name: 'query_database',
          arguments: { query },
      });
      const result = QueryToolSchema.parse(resultRaw);
      if (result.isError) {
          res.status(400).json({ error: result.content[0].text });
      } else {
          const content = JSON.parse(result.content[0].text);
          res.json(content);
      }
  } catch (error: any) {
      res.status(500).json({ error: error.message });
  }
});

// Start the Express server on port 3000
app.listen(3000, () => {
  console.log('Web server running on port 3000');
});

// Handle process cleanup
process.on('exit', () => {
  mcpProcess.kill(); // Ensure the subprocess is terminated when the main process exits
});