import axios from 'axios';
import { AIProvider } from './ai-provider';
import { logToFile } from './mcp-server';

interface HuggingFaceResponse {
    generated_text?: string; // Optional, as it may not always be present
}

export class HuggingFaceAIProvider implements AIProvider {
    private apiKey: string;
    private model: string;
    private endpoint: string = 'https://api-inference.huggingface.co/models';

    constructor(apiKey: string, model: string = 'meta-llama/Meta-Llama-3-8B') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateQuery(schemaInfo: string, mode: string, userQuery: string, dbType: string): Promise<string | object> {
        const prompt = dbType === 'mongodb'
        ? mode === 'search'
            ? `Given the schema: ${schemaInfo}\nGenerate a MongoDB query object to search for: "${userQuery}".\nUse "find".\nExample: "find users over 25" becomes:\n\`\`\`json\n{ "collection": "users", "operation": "find", "filter": { "age": { "$gt": 25 } } }\n\`\`\`\nReturn only the query object in a code block like that.`
            : `Given the schema: ${schemaInfo}\nGenerate a MongoDB query object to modify the database for: "${userQuery}".\nUse "insertOne", "updateOne", or "deleteOne".\nExample: "add a user named John aged 30" becomes:\n\`\`\`json\n{ "collection": "users", "operation": "insertOne", "document": { "name": "John", "age": 30 } }\n\`\`\`\nReturn only the query object in a code block like that.`
        : mode === 'search'
            ? `You are an expert SQL query generator. Given the following database schema:

                ${schemaInfo}

                Tables and columns:
                - manufacturers(id, name, location)
                - clothes(id, manufacturer_id, type, size, color, price)
                - stores(id, name, location)
                - customers(id, name, email, address)
                - sales(id, customer_id, clothing_id, store_id, sale_date, quantity)

                Generate a SQL SELECT query (using standard ANSI SQL) to answer the user's question: "${userQuery}"

                Instructions:
                1. Identify which table and column(s) are needed. In this schema, "clothes.type" holds the clothing type (e.g., "pants", "shirts").
                2. If the user is asking for a count, use "COUNT(*)".
                3. Return only the SQL query inside a code block like this:
                SELECT ...;
                4. Do not include any explanation, comments, or extra text—only the SQL statement.

                Example:
                - If the user asks "How many pants are there?", your answer should be exactly:
                SELECT COUNT(*) AS total_pants
                FROM clothes
                WHERE type = 'pants';

                Now, generate the query for: "${userQuery}".
                `
            : `Given the schema: ${schemaInfo}\nGenerate a SQL query (INSERT, UPDATE, or DELETE) to modify the database for: "${userQuery}".\nExample: "add a user named John aged 30" becomes:\n\`\`\`sql\nINSERT INTO users (name, age) VALUES ('John', 30)\n\`\`\`\nReturn only the query in a code block like that.`;

        logToFile(`Generated prompt: ${prompt}`);
        const response = await axios.post<HuggingFaceResponse[]>(
            `${this.endpoint}/${this.model}`,
            { inputs: prompt, parameters: { return_full_text: false } },
            { headers: { Authorization: `Bearer ${this.apiKey}` } }
        );
        const text = Array.isArray(response.data) && response.data[0]?.generated_text
            ? response.data[0].generated_text
            : JSON.stringify(response.data);
        if (dbType === 'mongodb') {
            const match = text.match(/```json\n([\s\S]*?)\n```/);
            return match ? JSON.parse(match[1]) : text.trim();
        } else {
            const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
            return sqlMatch ? sqlMatch[1].trim() : text.trim();
        }
    }

    async generateExplanation(userQuery: string, results: any[]): Promise<string> {
        const prompt = results.length === 0
            ? `User query: '${userQuery}'. No data found. Respond with a natural language message indicating no information is available.`
            : `User query: '${userQuery}'. Results: ${JSON.stringify(results)}. Provide a concise natural language summary based only on these results.`;

        const response = await axios.post<HuggingFaceResponse[]>(
            `${this.endpoint}/${this.model}`,
            { inputs: prompt, parameters: { return_full_text: false } },
            { headers: { Authorization: `Bearer ${this.apiKey}` } }
        );
        const text = Array.isArray(response.data) && response.data[0]?.generated_text
            ? response.data[0].generated_text
            : JSON.stringify(response.data);
        return text;
    }
}