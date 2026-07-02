import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function run() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const res = await ai.models.list();
        for await (const m of res) {
            if (m.name.includes("embed")) {
                console.log(m.name, m.supportedGenerationMethods);
            }
        }
    } catch (e: any) {
        console.error("error", e.message);
    }
}
run();
