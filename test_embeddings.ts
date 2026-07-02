import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

async function run() {
    console.log("Key:", API_KEY?.substring(0, 10));
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    try {
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: 'hello world',
            config: {
                outputDimensionality: 3072
            }
        });
        console.log("Embedding length:", response.embeddings[0].values.length);
    } catch (e: any) {
        console.error("Error:", e);
    }
}
run();
