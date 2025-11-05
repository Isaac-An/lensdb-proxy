import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {firebase} from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    googleAI({
      // The API key is read from the GEMINI_API_KEY environment variable.
    }),
    firebase({
      credential: 'application-default',
    }),
  ],
  model: 'googleai/gemini-2.5-flash',
});
