import { GoogleGenAI, Type } from "@google/genai";
import { MangaStyle } from "../types";

// Note: GEMINI_API_KEY is handled by AI Studio environment and injected via process.env

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  // We don't throw custom errors here, allowing the SDK call to proceed.
  // In the AI Studio environment, this allows the platform to trigger the 
  // "Please provide an API Key" UI if the key is missing or invalid.
  return new GoogleGenAI({ apiKey });
}

export async function parseMangaStoryboard(text: string): Promise<{ description: string; style: MangaStyle }[]> {
  const model = "gemini-3-flash-preview";
  const ai = getAiClient();

  const prompt = `You are a professional manga editor. Extract manga panel information from the following planning document.
For each panel/scene:
1. Provide a detailed SCENE DESCRIPTION for an AI image generator (Nanobanana).
2. Choose the most appropriate style from: 'Hokuto no Ken', 'Dragon Ball', 'Standard Manga', 'Noir', 'Sci-Fi'. 
   - Note: If it's "劇画" or "修羅", use 'Hokuto no Ken'. If it's "少年マンガ" or dynamic action with sharp hair, use 'Dragon Ball'.

Planning Document:
${text}

Return the list of panels in the specified JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: {
                type: Type.STRING,
                description: "Detailed description of the scene for an image generator."
              },
              style: {
                type: Type.STRING,
                enum: ['Hokuto no Ken', 'Dragon Ball', 'Standard Manga', 'Noir', 'Sci-Fi'],
                description: "The visual style of the panel."
              }
            },
            required: ["description", "style"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Error parsing storyboard:", error);
    throw error;
  }
}

export async function generateMangaPanel(
  description: string,
  style: MangaStyle,
  characterImageBase64?: string
) {
  const model = "gemini-3.1-flash-image-preview";
  const ai = getAiClient();
  
  const stylePrompts: Record<MangaStyle, string> = {
    'Hokuto no Ken': 'Hyper-detailed, masculine, dramatic shadows, cross-hatching, 1980s epic manga style, thick lines, intense expressions, Fist of the North Star aesthetic.',
    'Dragon Ball': 'Clean lines, dynamic poses, pointy hair, Akira Toriyama style, expressive eyes, simple but effective shading, shonen manga action style.',
    'Standard Manga': 'Modern clean manga style, screen tones, balanced detail, professional black and white manga page look.',
    'Noir': 'Heavy black areas, high contrast, Sin City meets manga, dramatic lighting, gritty texture, ink wash style.',
    'Sci-Fi': 'Mechanical details, futuristic screentones, cyberpunk elements, detailed backgrounds, high-tech manga aesthetic.'
  };

  const basePrompt = `Generate a high-quality professional black and white manga panel. 
Style: ${stylePrompts[style] || stylePrompts['Standard Manga']}
Action/Scene: ${description}
The output must be a single manga panel, black and white, with screentones.`;

  const contents: any = {
    parts: [
      { text: basePrompt }
    ]
  };

  if (characterImageBase64) {
    // Add character reference if provided
    // Expecting base64 string without the prefix data:image/...;base64,
    const cleanBase64 = characterImageBase64.split(',')[1] || characterImageBase64;
    contents.parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: "image/png"
      }
    });
    contents.parts[0].text += "\nUse the attached character image as a visual reference for the character in the panel. Ensure visual identity consistency.";
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No candidates returned from Gemini");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in response parts");
  } catch (error) {
    console.error("Error generating manga panel:", error);
    throw error;
  }
}
