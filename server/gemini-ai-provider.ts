import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider } from './ai-provider';
import { logToFile } from "./mcp-server";

export class GeminiAIProvider implements AIProvider {
    private model: any;

    constructor(apiKey: string) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    async generateQuery(schemaInfo: string, mode: string, userQuery: string, dbType: string): Promise<string | object> {
        const prompt = dbType === 'mongodb'
        ? mode === 'search'
            ? `${schemaInfo}\nGenerate a MongoDB query object to search for: "${userQuery}".\nUse "find".\nExample: "find users over 25" becomes:\n\`\`\`json\n{ "collection": "users", "operation": "find", "filter": { "age": { "$gt": 25 } } }\n\`\`\`\nReturn only the query object in a code block like that.`
            : `${schemaInfo}\nGenerate a MongoDB query object to modify the database for: "${userQuery}".\nUse "insertOne", "updateOne", or "deleteOne".\nExample: "add a user named John aged 30" becomes:\n\`\`\`json\n{ "collection": "users", "operation": "insertOne", "document": { "name": "John", "age": 30 } }\n\`\`\`\nReturn only the query object in a code block like that.`
        : mode === 'search'
            ? `${schemaInfo}\nGenerate a SQL SELECT query for: "${userQuery}".\nExample: "show all users over 25" becomes:\n\`\`\`sql\nSELECT * FROM users WHERE age > 25\n\`\`\`\nReturn only the query in a code block like that.`
            : `${schemaInfo}\nGenerate a SQL query (INSERT, UPDATE, or DELETE) to modify the database for: "${userQuery}".\nExample: "add a user named John aged 30" becomes:\n\`\`\`sql\nINSERT INTO users (name, age) VALUES ('John', 30)\n\`\`\`\nReturn only the query in a code block like that.`;
        
        logToFile(`Generated prompt: ${prompt}`);
        const result = await this.model.generateContent(prompt);
        const text = result.response.text();

        let query: string | object;
        if (dbType === 'mongodb') {
            const match = text.match(/```json\n([\s\S]*?)\n```/);
            query = match ? JSON.parse(match[1]) : text.trim();
        } else {
            const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
            query = sqlMatch ? sqlMatch[1].trim() : text.trim();
        }
        return query;
    }

    async generateExplanation(userQuery: string, results: any[]): Promise<string> {
        const prompt = results.length === 0
            ? `The user's query was: '${userQuery}'. No data was found in the database. Provide a natural language response indicating that no information is available.`
            : `The user's query was: '${userQuery}'. The database returned the following results: ${JSON.stringify(results)}. Provide a concise natural language summary of these results, strictly based on the data provided. Do not include any information not present in the results.`;
        
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }
}