
'use server';

import * as admin from 'firebase-admin';
import { firebaseConfig } from '@/firebase/config';

// Initialize firebase-admin if it hasn't been already.
if (!admin.apps.length) {
  try {
    // When running in a Google Cloud environment, the SDK will automatically
    // find the necessary service account credentials.
    admin.initializeApp({
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
  if (!admin.apps.length) {
      console.error("Firebase admin is not initialized.");
      return { url: null };
  }

  try {
    const bucket = admin.storage().bucket();
    // Ensure the filename is clean and doesn't contain path traversal characters
    const safeFileName = fileName.replace(/\.\.\//g, '');
    const file = bucket.file(safeFileName);

    // Check if the file exists first.
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`File not found in Firebase Storage: ${safeFileName}`);
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
    // In case of any other error, return null.
    return { url: null };
  }
}
