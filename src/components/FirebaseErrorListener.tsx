'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      if (process.env.NODE_ENV === 'production') {
        // In production, set the error to be thrown. This will be caught by Next.js error boundaries.
        setError(error);
      } else {
        // In development, we log the error to the console for visibility
        // but do not throw it, to avoid crashing the entire application.
        // This allows developers to see UI layout and style pages even if backend permissions aren't fully configured.
        console.error(
          'FirebaseErrorListener caught a permission error (suppressed in development):',
          error
        );
      }
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on('permission-error', handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // On re-render, if an error exists in state, throw it.
  // This will now only happen in production due to the logic in useEffect.
  if (error) {
    throw error;
  }

  // This component renders nothing.
  return null;
}
