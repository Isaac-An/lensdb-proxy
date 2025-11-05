import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: firebaseConfig.storageBucket,
  });
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
