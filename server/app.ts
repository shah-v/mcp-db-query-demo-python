import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';

interface QueryRequestBody {
  query: string;
  aiProvider: string;
}

const QueryToolSchema = z.object({
  content: z.array(z.object({ text: z.string() })),
  isError: z.boolean().optional()
});

const app = express();

// Proxy requests to server.ts on port 3001
app.use('/api/load-db', createProxyMiddleware({ target: 'http://localhost:3001/api/load-db', changeOrigin: true, logger: console }));
app.use('/api/is-db-loaded', createProxyMiddleware({ target: 'http://localhost:3001/api/is-db-loaded', changeOrigin: true, logger: console }));

app.use(express.json()); // Parse JSON request bodies
app.use(express.static('static')); // Serve static files like index.html

// Create the transport using the existing process
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['ts-node', 'server/mcp-server.ts'],
});

const client = new Client({ name: 'web-client', version: '1.0.0' });

// Connect with retry logic
let isClientConnected = false;

// Update connection logic to set flag
async function connectWithRetry(retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await client.connect(transport);
      console.log('Connected to MCP server');
      isClientConnected = true;
      return true;
    } catch (error: any) {
      console.warn(`Connection attempt ${i + 1} failed: ${error.message}`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Failed to connect to MCP server after retries');
  process.exit(1);
}

// Initialize connection
connectWithRetry();

// Handle /api/query requests using the persistent client
app.post('/api/query', async (req: any, res: any) => {
  const { query, aiProvider } = req.body;
  console.log(`Received query: "${query}" with AI provider: "${aiProvider}"`);
  if (!isClientConnected) {
    return res.status(503).json({ error: 'MCP server not yet connected, please try again later' });
  }
  try {
    const startTime = Date.now();
    const resultRaw = await client.callTool({
      name: 'query_database',
      arguments: { query, aiProvider },
    });
    const duration = Date.now() - startTime;
    console.log(`Query "${query}" processed in ${duration}ms`);

    const result = QueryToolSchema.parse(resultRaw);
    if (result.isError) {
      console.error(`Query error: ${result.content[0].text}`);
      res.status(400).json({ error: result.content[0].text });
    } else {
      const content = JSON.parse(result.content[0].text);
      res.json(content);
    }
  } catch (error: any) {
    console.error(`Query failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server on port 3000
app.listen(3000, () => {
  console.log('Web server running on port 3000');
});