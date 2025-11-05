
'use server';
/**
 * @fileOverview A server-side flow to retrieve a signed URL for a PDF from Firebase Storage.
 *
 * - getPdfUrl - A function that returns a signed URL for a given filename.
 * - GetPdfUrlInput - The input schema for the getPdfUrl function.
 * - GetPdfUrlOutput - The output schema for the getPdfUrl function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { firebaseConfig } from '@/firebase/config';

// Safely initialize firebase-admin on the server.
if (!admin.apps.length) {
  try {
    // In a Google Cloud environment, the credentials can be found automatically.
    // For local development, you'd set the GOOGLE_APPLICATION_CREDENTIALS env var.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: firebaseConfig.storageBucket,
    });
  } catch (e) {
    console.error('Firebase Admin initialization failed:', e);
  }
}


export const GetPdfUrlInputSchema = z.object({
  fileName: z.string().describe('The name of the PDF file in Firebase Storage.'),
});
export type GetPdfUrlInput = z.infer<typeof GetPdfUrlInputSchema>;

export const GetPdfUrlOutputSchema = z.object({
  url: z.string().nullable().describe('The signed download URL for the PDF, or null if not found.'),
});
export type GetPdfUrlOutput = z.infer<typeof GetPdfUrlOutputSchema>;

// This is the exported function that the client will call.
export async function getPdfUrl(input: GetPdfUrlInput): Promise<GetPdfUrlOutput> {
  return getPdfUrlFlow(input);
}

const getPdfUrlFlow = ai.defineFlow(
  {
    name: 'getPdfUrlFlow',
    inputSchema: GetPdfUrlInputSchema,
    outputSchema: GetPdfUrlOutputSchema,
  },
  async ({ fileName }) => {
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(fileName);

      // Check if the file exists first.
      const [exists] = await file.exists();
      if (!exists) {
        return { url: null };
      }

      // Get a signed URL that expires in 15 minutes.
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      });

      return { url };
    } catch (error) {
      console.error(`Error getting signed URL for ${fileName}:`, error);
      // In case of any other error, return null to prevent client-side crashes.
      return { url: null };
    }
  }
);
