import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

(async () => {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["ts-node", "server.ts"]
  });

  const client = new Client({
    name: "farming-client",
    version: "1.0.0"
  });

  try {
    await client.connect(transport);

    // Fetch farm info
    const farmInfoResult = await client.callTool({
      name: "get_farm_info",
      arguments: { farmName: "Green Acres" }
    });
    const farmContent = farmInfoResult.content as { type: string; text: string }[];
    console.log("Farm Info:", farmContent[0].text);

    // Fetch crops
    const cropsResult = await client.callTool({
      name: "get_crops_by_farm",
      arguments: { farmName: "Green Acres" }
    });
    const cropsContent = cropsResult.content as { type: string; text: string }[];
    console.log("Crops:", cropsContent[0].text);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Cleanup (assuming 'close' exists)
    if (typeof client.close === "function") {
      await client.close();
    }
  }
})();