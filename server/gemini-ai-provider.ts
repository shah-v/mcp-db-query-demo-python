import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider } from './ai-provider';
import { logToFile } from "./mcp-server";
import { generateExplanationPrompt, generateQueryPrompt } from "./prompt-utils";

export class GeminiAIProvider implements AIProvider {
    private model: any;

    constructor(apiKey: string) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    async generateQuery(params: {
        schemaInfo: string;
        mode: string;
        userQuery: string;
        dbType: string;
    }): Promise<string | object> {
        const prompt = generateQueryPrompt(params);
        logToFile(`Gemini API Request:
            Model: ${this.model.model}
            Prompt: ${prompt}`);
        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        logToFile(`Gemini API Response: ${JSON.stringify(text)}`);

        let query: string | object;
        if (params.dbType === 'mongodb') {
            const match = text.match(/```json\n([\s\S]*?)\n```/);
            query = match ? JSON.parse(match[1]) : text.trim();
        } else {
            const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
            query = sqlMatch ? sqlMatch[1].trim() : text.trim();
        }
        logToFile(`Gemini Extracted Query: ${JSON.stringify(query)}`);
        return query;
    }

    async generateExplanation(params: {
        userQuery: string;
        results: any[];
    }): Promise<string> {
        const { userQuery, results } = params;
        const prompt = generateExplanationPrompt(params);
        logToFile(`Gemini API Request explanation:
        Model: ${this.model.model}
        Prompt: ${prompt}`);
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }
}