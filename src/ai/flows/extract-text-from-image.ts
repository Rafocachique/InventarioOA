
'use server';
/**
 * @fileOverview Flow to extract text from an image using OCR.
 *
 * - extractTextFromImage - A function that handles the text extraction process.
 * - ExtractTextFromImageInput - The input type for the function.
 * - ExtractTextFromImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractTextFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractTextFromImageInput = z.infer<typeof ExtractTextFromImageInputSchema>;

const ExtractTextFromImageOutputSchema = z.object({
  text: z.string().describe('The extracted text from the image.'),
});
export type ExtractTextFromImageOutput = z.infer<typeof ExtractTextFromImageOutputSchema>;

export async function extractTextFromImage(input: ExtractTextFromImageInput): Promise<ExtractTextFromImageOutput> {
  return extractTextFromImageFlow(input);
}

const extractTextFromImageFlow = ai.defineFlow(
  {
    name: 'extractTextFromImageFlow',
    inputSchema: ExtractTextFromImageInputSchema,
    outputSchema: ExtractTextFromImageOutputSchema,
  },
  async (input) => {
    const llmResponse = await ai.generate({
      prompt: [
        { text: 'Extract all text content from the following image. Focus on identifiers, codes, or numbers. Respond only with the extracted text, with no extra formatting or labels.' },
        { media: { url: input.photoDataUri } },
      ],
      model: 'googleai/gemini-1.5-flash-latest',
    });

    return {
      text: llmResponse.text(),
    };
  }
);
