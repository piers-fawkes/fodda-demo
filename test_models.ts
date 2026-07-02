import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function run() {
    try {
        console.log("Testing text-embedding-004");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const res1 = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: 'test'
        });
        console.log("Success text-embedding-004", res1.embeddings?.length);
    } catch (e: any) {
        console.error("1:", e.message);
    }

    try {
        console.log("Testing models/text-embedding-004");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const res1 = await ai.models.embedContent({
            model: 'models/text-embedding-004',
            contents: 'test'
        });
        console.log("Success models/text-embedding-004", res1.embeddings?.length);
    } catch (e: any) {
        console.error("2:", e.message);
    }

    // Try old package
    try {
        const genai = require("@google/generative-ai");
        const ai2 = new genai.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const res2 = await ai2.getGenerativeModel({ model: "text-embedding-004" }).embedContent("test");
        console.log("Success old SDK", res2.embedding?.values?.length);
    } catch (e: any) {
        console.error("3:", e.message);
    }
}
run();
