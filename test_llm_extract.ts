import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function extractCoreSemantics(userQuery: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
    Extract the core semantic meaning from the following conversational question.
    Remove filler words, questions phrases ("What do trend lines say about", "How does"), and keep only the core entities, topics, and actions.
    Return ONLY the extracted string.
    
    Question: ${userQuery}
    Extracted:`;

    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });
    return result.text?.trim() || userQuery;
}

async function run() {
    const questions = [
        "What do trend lines say about Consumers 25-35 leaning into / gravitating away from “fast fashion”",
        "To what extent are ‘Zillennials’ (currently 25-35 y/o) trending towards or away from “knowledge work” as a career?",
        "What evidence is there of a shift to “fewer, better” as a purchasing philosophy?",
        "What cities are setting the global style agenda right now?",
        "How does place of origin or place of construction of an item effect purchase decisions for consumers 25-35 globally?"
    ];

    for (const q of questions) {
        console.log("Original: ", q);
        console.log("Extracted:", await extractCoreSemantics(q));
        console.log("---");
    }
}
run();
