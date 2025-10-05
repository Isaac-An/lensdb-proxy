'use server';

import { generateProductInsights } from '@/ai/flows/generate-product-insights';
import type { Lens } from './lib/types';

export async function getAIInsights(
  lenses: Lens[]
): Promise<{ insights: string } | { error: string }> {
  if (lenses.length === 0) {
    return { error: 'No product data to analyze.' };
  }

  try {
    const productData = JSON.stringify(
      lenses.map(
        // We only send a subset of data to the AI to keep the payload small
        ({ name, efl, fNo, fovD, price, sensorSize, mountType }) => ({
          name,
          efl,
          fNo,
          fovD,
          price,
          sensorSize,
          mountType,
        })
      ),
      null,
      2
    );
    const result = await generateProductInsights({ productData });
    return result;
  } catch (e) {
    console.error(e);
    // This could be a more specific error message
    return { error: 'An unexpected error occurred while generating insights.' };
  }
}
