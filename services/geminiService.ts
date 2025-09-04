import { GoogleGenAI, Type } from '@google/genai';
import { SelectedField, ExtractedData, IdField } from '../types.ts';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractIdData(
  base64Image: string,
  mimeType: string,
  fieldsToExtract: SelectedField[]
): Promise<ExtractedData> {
  const model = 'gemini-2.5-flash';

  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: base64Image,
    },
  };
  
  // Dynamically build the response schema based on user selection
  const schemaProperties: { [key: string]: { type: Type, description: string } } = {};
  let fieldDescriptions = '';
  
  fieldsToExtract.forEach(item => {
    if (item.field) {
      // Use a consistent key for the schema (e.g., 'ID_Number')
      const schemaKey = item.field.replace(/\s+/g, '_');
      
      let description = `The ${item.field} extracted from the ID card in ${item.language}.`;
      if (item.field === 'Expiry Date') {
        description = `The Expiry Date extracted from the card, formatted as YYYY-MM-DD.`;
      }

      schemaProperties[schemaKey] = {
        type: Type.STRING,
        description: description
      };
      fieldDescriptions += `- **${item.field}**: in **${item.language}**\n`;
    }
  });

  const responseSchema = {
    type: Type.OBJECT,
    properties: schemaProperties,
  };
  
  const systemInstruction = `You are an expert multilingual ID card data extraction agent. Your task is to accurately analyze an ID card image and extract specified fields in the requested language.
- For names requested in Arabic, provide the exact Arabic script from the card.
- For names requested in English, provide the English version from the card.
- For all other fields, extract the information and translate it to the requested language if the original script is different. For example, if the country is written in Arabic and English is requested, provide the English translation.
- Pay close attention to dates and numbers.
- Return the data ONLY in the structured JSON format defined by the provided schema. Do not include any extra text, apologies, or explanations.`;

  const prompt = `
    Please analyze the provided ID card image.
    Extract the following information, adhering to the language requirements for each field:
    ${fieldDescriptions}
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [imagePart, { text: prompt }],
    },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
    },
  });
  
  const jsonText = response.text.trim();
  
  try {
    // Gemini sometimes wraps the JSON in markdown, so we need to clean it.
    const cleanJsonText = jsonText.replace(/^```json\s*|```$/g, '');
    const parsedJson = JSON.parse(cleanJsonText);
    
    // Remap the keys from 'ID_Number' back to 'ID Number' for the UI
    const finalData: ExtractedData = {};
    for (const key in parsedJson) {
      const originalField = key.replace(/_/g, ' ') as IdField;
      finalData[originalField] = parsedJson[key];
    }
    return finalData;

  } catch (error) {
    console.error("Failed to parse Gemini response:", jsonText);
    throw new Error("Could not parse the data from the ID card. The response was not valid JSON.");
  }
}