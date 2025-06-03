import { AIProvider } from './ai-provider';
import { GeminiAIProvider } from './gemini-ai-provider';
import { HuggingFaceAIProvider } from './huggingface-ai-provider';

export function createAIProvider(): AIProvider {
    const provider = process.env.AI_PROVIDER || 'gemini';
    if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
        return new GeminiAIProvider(apiKey);
    } else if (provider === 'huggingface') {
        const apiKey = process.env.HUGGINGFACE_API_KEY;
        const model = process.env.HUGGINGFACE_MODEL || 'mistralai/Mixtral-8x7B-Instruct-v0.1';
        if (!apiKey) throw new Error('HUGGINGFACE_API_KEY is not set');
        return new HuggingFaceAIProvider(apiKey, model);
    } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
}