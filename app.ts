import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

const QueryToolSchema = z.object({
    content: z.array(z.object({ text: z.string() })),
    isError: z.boolean().optional()
  });

const app = express();
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('.')); // Serve static files like index.html

app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['ts-node', 'server.ts'],
  });
  const client = new Client({ name: 'web-client', version: '1.0.0' });
  try {
    await client.connect(transport);
    const resultRaw = await client.callTool({
      name: 'query_database',
      arguments: { query },
    });
    const result = QueryToolSchema.parse(resultRaw);
    if (result.isError) {
      // Tool returned an error, send the plain text message as JSON
      res.status(400).json({ error: result.content[0].text });
    } else {
      // Tool succeeded, parse the content as JSON
      const content = JSON.parse(result.content[0].text);
      res.json(content);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  } finally {
    await client.close();
  }
});

app.listen(3000, () => {
  console.log('Web server running on port 3000');
});