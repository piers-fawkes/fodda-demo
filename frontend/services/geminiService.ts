
import { GoogleGenAI } from "@google/genai";
import { RetrievalResult, Vertical } from '../../shared/types';

const getSystemInstruction = (vertical: Vertical): string => {
  return `
ROLE: You are the Fodda ${vertical} Intelligence Engine. 

CONSTRAINTS:
1. **Zero Hallucination**: Only answer using the "CONTEXT DATA" below. If context is missing, say you have no curated records for that topic.
2. **Citations**: Link insights to the graph using these anchors:
   - For Trends: ### [Trend Name](#trend-trendId)
   - For Evidence: ### [Title/Brand](#article-articleId)

STRUCTURE:
# INSIGHT SYNTHESIS
Summarize the key takeaways from the retrieved graph nodes.
# GROUNDED ANALYSIS
### [Trend Name](#trend-trendId)
Explain this trend based strictly on the provided description.
### [Evidence Title](#article-articleId)
Detail how this specific article supports the trend or query.

TONE: Factual, professional, no jargon.
`;
};

const formatContext = (data: RetrievalResult): string => {
  if (!data.ok || data.rows.length === 0) {
    return "CONTEXT DATA: [EMPTY]. No matching records found in the Knowledge Graph.";
  }
  
  let ctx = "CONTEXT DATA (From Knowledge Graph):\n\n";
  data.rows.forEach(row => {
    ctx += `TREND: ${row.trendName} (ID: ${row.trendId})\n`;
    ctx += `DESCRIPTION: ${row.trendDescription}\n`;
    ctx += `EVIDENCE ARTICLES:\n`;
    row.evidence.forEach(a => {
      ctx += `- [${a.articleId}] ${a.title} (Source: ${a.sourceUrl})\n`;
    });
    ctx += `---\n`;
  });
  
  return ctx;
};

export const generateResponse = async (
  query: string,
  vertical: Vertical,
  retrievedData: RetrievalResult
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `${formatContext(retrievedData)}\n\nUSER QUERY: ${query}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        systemInstruction: getSystemInstruction(vertical),
        temperature: 0.0,
      }
    });
    
    return response.text || "No synthesis available.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The intelligence engine encountered a processing error.";
  }
};
