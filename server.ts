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
    close: promisify(db.close.bind(db)) as () => Promise<void>
  };
};

// Initialize MCP Server
const server = new McpServer({
  name: "Farming Database Server",
  version: "1.0.0"
});

// Tool: Get farm information
server.tool(
  "get_farm_info",
  { farmName: z.string() },
  async ({ farmName }: { farmName: string }) => {
    const db = getDb();
    try {
      const rows: any[] = await db.all("SELECT * FROM farms WHERE name = ?", [farmName]);
      if (rows.length === 0) {
        return {
          content: [{ type: "text", text: "Farm not found" }],
          isError: true
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(rows[0], null, 2) }]
      };
    } finally {
      await db.close();
    }
  }
);

// Tool: Get crops by farm
server.tool(
  "get_crops_by_farm",
  { farmName: z.string() },
  async ({ farmName }: { farmName: string }) => {
    const db = getDb();
    try {
      const rows: any[] = await db.all(
        `SELECT c.* FROM crops c
         JOIN farms f ON c.farm_id = f.id
         WHERE f.name = ?`,
        [farmName]
      );
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }]
      };
    } finally {
      await db.close();
    }
  }
);

// Resource: Expose database schema
server.resource(
  "schema",
  "schema://farming",
  async (uri: URL) => {
    const db = getDb();
    try {
      const tables: any[] = await db.all("SELECT name, sql FROM sqlite_master WHERE type='table'", []);
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(tables, null, 2)
        }]
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