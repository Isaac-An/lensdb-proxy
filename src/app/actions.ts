
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
  productName: string;
  pdfUrlField: string | undefined;
};

type GetStorageFileUrlOutput = {
  url: string | null;
};

export async function getStorageFileUrl(input: GetStorageFileUrlInput): Promise<GetStorageFileUrlOutput> {
  const { productName, pdfUrlField } = input;
  console.log(`[Server Action] Received request for product: "${productName}", pdfUrlField: "${pdfUrlField}"`);

  if (!admin.apps.length) {
      console.error("[Server Action] Firebase admin is not initialized.");
      return { url: null };
  }

  // 1. If pdfUrlField is already a full HTTPS URL, return it directly.
  if (pdfUrlField && pdfUrlField.startsWith('https://')) {
    console.log(`[Server Action] pdfUrlField is a direct URL. Returning: "${pdfUrlField}"`);
    return { url: pdfUrlField };
  }

  // 2. Determine the filename to fetch from Storage.
  let fileNameToFetch: string;
  if (pdfUrlField && pdfUrlField.trim()) {
    // Use the value from pdfUrlField if it's a filename.
    fileNameToFetch = pdfUrlField.trim();
  } else {
    // Otherwise, generate it from the product name.
    fileNameToFetch = `${productName.trim()}.pdf`;
  }
  
  console.log(`[Server Action] Attempting to get signed URL for: "${fileNameToFetch}"`);

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(fileNameToFetch);

    const [exists] = await file.exists();
    if (!exists) {
      console.log(`[Server Action] File not found in Firebase Storage: "${fileNameToFetch}"`);
      return { url: null };
    }

    console.log(`[Server Action] File found: "${fileNameToFetch}". Generating signed URL.`);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return { url };
  } catch (error) {
    console.error(`[Server Action] Error getting signed URL for "${fileNameToFetch}":`, error);
    return { url: null };
  }
}
