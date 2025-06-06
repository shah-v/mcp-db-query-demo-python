import axios from 'axios';
import { AIProvider } from './ai-provider';
import { logToFile } from './mcp-server';
import { generateExplanationPrompt, generateQueryPrompt } from './prompt-utils';

interface NovitaResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export class NovitaAIProvider implements AIProvider {
    private apiKey: string;
    private model: string;
    private endpoint: string = 'https://router.huggingface.co/novita/v3/openai/chat/completions';

    constructor(apiKey: string, model: string = 'deepseek/deepseek-r1-turbo') {
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
        const payload = {
            messages: [{ role: 'user', content: prompt }],
            model: this.model,
            stream: false,
        };
        const headers = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
        logToFile(`Novita API Request:
            URL: ${this.endpoint}
            Headers: ${JSON.stringify(headers)}
            Payload: ${JSON.stringify(payload)}`);
        const response = await axios.post<NovitaResponse>(this.endpoint, payload, { headers });
        const text = response.data.choices[0].message.content;
        logToFile(`Novita API Response: ${JSON.stringify(text)}`);
    
        let query: string | object = this.extractQuery(text, params.dbType);
        logToFile(`Novita Extracted Query: ${JSON.stringify(query)}`);
        return query;
    }

    async generateExplanation(params: {
        userQuery: string;
        results: any[];
    }): Promise<string> {
        const prompt = generateExplanationPrompt(params);
        
        const payload = {
            messages: [{ role: 'user', content: prompt }],
            model: this.model,
            stream: false,
        };

        const headers = { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
        logToFile(`Novita API Request explanation:
        URL: ${this.endpoint}
        Headers: ${JSON.stringify(headers)}
        Payload: ${JSON.stringify(payload)}`);
        const response = await axios.post<NovitaResponse>(this.endpoint, payload, { headers });

        return response.data.choices[0].message.content;
    }

    private extractQuery(text: string, dbType: string): string | object {
        const withoutThink = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
        if (dbType === 'mongodb') {
            const match = withoutThink.match(/```json\n([\s\S]*?)\n```/);
            return match ? JSON.parse(match[1]) : withoutThink;
        } else {
            const sqlMatch = withoutThink.match(/```sql\n([\s\S]*?)\n```/);
            return sqlMatch ? sqlMatch[1].trim() : withoutThink;
        }
    }
    
}