import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {firebase} from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    googleAI({
      // The API key is read from the GEMINI_API_KEY environment variable.
      // initialze the firebase admin app
      firebase: {
        credential: 'application-default',
      },
    }),
    firebase(),
  ],
  model: 'googleai/gemini-2.5-flash',
});
