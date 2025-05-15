import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import { z } from "zod";
import { URL } from "url";

// Database connection helper
const getDb = () => {
  const db = new sqlite3.Database("farming.db");
  return {
    all: promisify(db.all.bind(db)) as (sql: string, params: any[]) => Promise<any[]>,
    close: promisify(db.close.bind(db)) as () => Promise<void>,
  };
};

// Initialize MCP Server
const server = new McpServer({
  name: "Farming Database Server",
  version: "1.0.0",
});

// Define the expected return type for tool functions
type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

// Internal function: Get farm information
async function getFarmInfo(args: { farmName: string }, extra: any): Promise<ToolResult> {
  const db = getDb();
  try {
    const rows = await db.all("SELECT * FROM farms WHERE name = ?", [args.farmName]);
    if (rows.length === 0) {
      return {
        content: [{ type: "text", text: "Farm not found" }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(rows[0], null, 2) }],
    };
  } finally {
    await db.close();
  }
}

// Internal function: Get crops by farm
async function getCropsByFarm(args: { farmName: string }, extra: any): Promise<ToolResult> {
  const db = getDb();
  try {
    const rows = await db.all(
      `SELECT c.* FROM crops c
       JOIN farms f ON c.farm_id = f.id
       WHERE f.name = ?`,
      [args.farmName]
    );
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
    };
  } finally {
    await db.close();
  }
}

// Internal function: Get farm count
async function getFarmCount(): Promise<ToolResult> {
  const db = getDb();
  try {
    const rows = await db.all("SELECT COUNT(*) as count FROM farms", []);
    return { content: [{ type: "text", text: `There are ${rows[0].count} farms.` }] };
  } finally {
    await db.close();
  }
}

// Internal function: List all farms
async function listAllFarms(): Promise<ToolResult> {
  const db = getDb();
  try {
    const rows = await db.all("SELECT * FROM farms", []);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  } finally {
    await db.close();
  }
}

// Internal function: Get farms by crop type
async function getFarmsByCropType(args: { cropType: string }, extra: any): Promise<ToolResult> {
  const db = getDb();
  try {
    const rows = await db.all(
      `SELECT f.* FROM farms f
       JOIN crops c ON f.id = c.farm_id
       WHERE c.type = ?`,
      [args.cropType]
    );
    if (rows.length === 0) {
      return { content: [{ type: "text", text: `No farms grow ${args.cropType}.` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  } finally {
    await db.close();
  }
}

// Query patterns for natural language queries
const queryPatterns = [
  {
    pattern: /how many farms|number of farms|count of farms/i,
    action: getFarmCount,
  },
  {
    pattern: /list all farms|show all farms|what farms are there/i,
    action: listAllFarms,
  },
  {
    pattern: /crops in (.*)|what crops does (.*) grow/i,
    action: async (farmName: string) => await getCropsByFarm({ farmName }, null),
    extractParams: (match: RegExpMatchArray) => [match[1].trim()],
  },
  {
    pattern: /tell me about (.*)|info on (.*)/i,
    action: async (farmName: string) => await getFarmInfo({ farmName }, null),
    extractParams: (match: RegExpMatchArray) => [match[1].trim()],
  },
  {
    pattern: /which farms grow (.*)/i,
    action: async (cropType: string) => await getFarmsByCropType({ cropType }, null),
    extractParams: (match: RegExpMatchArray) => [match[1].trim()],
  },
];

// Natural language query handler
async function queryDatabase(args: { query: string }, extra: any): Promise<ToolResult> {
  const { query } = args;
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?]/g, "");
  for (const pattern of queryPatterns) {
    const match = normalizedQuery.match(pattern.pattern);
    if (match) {
      if (pattern.extractParams) {
        // Extract the first parameter since action expects one string
        const [param] = pattern.extractParams(match);
        return await pattern.action(param);
      } else {
        // No parameters expected
        return await pattern.action();
      }
    }
  }
  return {
    content: [{
      type: "text",
      text: "Sorry, I don’t understand that query. Try something like: 'how many farms', 'list all farms', 'crops in Green Acres', or 'tell me about Sunny Fields'."
    }],
    isError: true,
  };
}

// Tool: Get farm information using internal function
server.tool("get_farm_info", { farmName: z.string() }, getFarmInfo);

// Tool: Get crops by farm using internal function
server.tool("get_crops_by_farm", { farmName: z.string() }, getCropsByFarm);

// Tool: Query database using natural language
server.tool("query_database", { query: z.string() }, queryDatabase);

// Resource: Expose database schema
server.resource(
  "schema",
  "schema://farming",
  async (uri: URL) => {
    const db = getDb();
    try {
      const tables = await db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", []);
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(tables, null, 2),
        }],
      };
    } finally {
      await db.close();
    }
  }
);

// Start the server
(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})().catch(console.error);