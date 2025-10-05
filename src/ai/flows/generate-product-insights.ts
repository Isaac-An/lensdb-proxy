'use server';

/**
 * @fileOverview Generates human-readable summaries of trends in product data using AI.
 *
 * - generateProductInsights - A function that generates product insights.
 * - GenerateProductInsightsInput - The input type for the generateProductInsights function.
 * - GenerateProductInsightsOutput - The return type for the generateProductInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductInsightsInputSchema = z.object({
  productData: z.string().describe('A string containing product data, e.g. in JSON or CSV format.'),
});
export type GenerateProductInsightsInput = z.infer<typeof GenerateProductInsightsInputSchema>;

const GenerateProductInsightsOutputSchema = z.object({
  insights: z.string().describe('A human-readable summary of trends and insights from the product data.'),
});
export type GenerateProductInsightsOutput = z.infer<typeof GenerateProductInsightsOutputSchema>;

export async function generateProductInsights(input: GenerateProductInsightsInput): Promise<GenerateProductInsightsOutput> {
  return generateProductInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductInsightsPrompt',
  input: {schema: GenerateProductInsightsInputSchema},
  output: {schema: GenerateProductInsightsOutputSchema},
  prompt: `You are an AI assistant that analyzes product data and generates human-readable summaries of trends and insights.

  Analyze the following product data and provide a summary of the key trends and insights. The summary should be concise and easy to understand.

  Product Data:
  {{productData}}

  Summary:`,
});

const generateProductInsightsFlow = ai.defineFlow(
  {
    name: 'generateProductInsightsFlow',
    inputSchema: GenerateProductInsightsInputSchema,
    outputSchema: GenerateProductInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
