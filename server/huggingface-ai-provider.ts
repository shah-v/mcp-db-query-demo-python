import axios from 'axios';
import { AIProvider } from './ai-provider';
import { logToFile } from './mcp-server';
import { generateExplanationPrompt, generateQueryPrompt } from './prompt-utils';

interface HuggingFaceResponse {
    generated_text?: string; // Optional, as it may not always be present
}

export class HuggingFaceAIProvider implements AIProvider {
    private apiKey: string;
    private model: string;
    private endpoint: string = 'https://api-inference.huggingface.co/models';

    constructor(apiKey: string, model: string = 'mistralai/Mixtral-8x7B-Instruct-v0.1') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateQuery(params: {
        schemaInfo: string;
        mode: string;
        userQuery: string;
        dbType: string;
    }): Promise<string | object> {
        const prompt = generateQueryPrompt(params);
        logToFile(`Generated prompt: ${prompt}`);
        logToFile(`model: ${this.model}`);
        const url = `${this.endpoint}/${this.model}`;
        const headers = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
        const payload = { inputs: prompt, parameters: { return_full_text: false } };
        logToFile(`HuggingFace API Request:
            URL: ${url}
            Headers: ${JSON.stringify(headers)}
            Payload: ${JSON.stringify(payload)}`);
        const response = await axios.post<HuggingFaceResponse[]>(url, payload, { headers });
        const text = Array.isArray(response.data) && response.data[0]?.generated_text
            ? response.data[0].generated_text
            : JSON.stringify(response.data);
        logToFile(`HuggingFace API Response: ${JSON.stringify(text)}`);
    
        let query: string | object;
        if (params.dbType === 'mongodb') {
            const match = text.match(/```json\n([\s\S]*?)\n```/);
            query = match ? JSON.parse(match[1]) : text.trim();
        } else {
            const sqlMatch = text.match(/```sql\n([\s\S]*?)\n```/);
            query = sqlMatch ? sqlMatch[1].trim() : text.trim();
        }
        logToFile(`HuggingFace Extracted Query: ${JSON.stringify(query)}`);
        return query;
    }

    async generateExplanation(params: {
        userQuery: string;
        results: any[];
    }): Promise<string> {
        const prompt = generateExplanationPrompt(params);
        const url = `${this.endpoint}/${this.model}`;
        const headers = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
        const payload = { inputs: prompt, parameters: { return_full_text: false } };
        logToFile(`HuggingFace API Request explanation:
        URL: ${url}
        Headers: ${JSON.stringify(headers)}
        Payload: ${JSON.stringify(payload)}`);
        const response = await axios.post<HuggingFaceResponse[]>(url, payload, { headers });
        const text = Array.isArray(response.data) && response.data[0]?.generated_text
            ? response.data[0].generated_text
            : JSON.stringify(response.data);
        return text;
    }
}