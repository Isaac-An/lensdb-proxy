
'use server';

import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';
import serviceAccount from '../../firebase-service-account.json';

// Initialize firebase-admin if it hasn't been already.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: firebaseConfig.storageBucket,
    });
  } catch (e) {
    console.error('Firebase admin initialization error in server action:', e);
  }
}

type GetStorageFileUrlInput = {
  fileName: string;
};

type GetStorageFileUrlOutput = {
  url: string | null;
};

export async function getStorageFileUrl(input: GetStorageFileUrlInput): Promise<GetStorageFileUrlOutput> {
  const { fileName } = input;
  console.log(`[Server Action] Attempting to get signed URL for: "${fileName}"`);
  
  if (!admin.apps.length) {
      console.error("[Server Action] Firebase admin is not initialized.");
      return { url: null };
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(fileName);

    // Check if the file exists first.
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`[Server Action] File not found in Firebase Storage: "${fileName}"`);
      return { url: null };
    }

    console.log(`[Server Action] File found: "${fileName}". Generating signed URL.`);
    // Get a signed URL that expires in 15 minutes.
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return { url };
  } catch (error) {
    console.error(`[Server Action] Error getting signed URL for "${fileName}":`, error);
    // In case of any other error, return null.
    return { url: null };
  }
}
