'use client';

import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

export async function initiateAnonymousSignIn(authInstance: Auth): Promise<void> {
  try {
    await signInAnonymously(authInstance);
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    throw error;
  }
}

export async function initiateEmailSignUp(
  authInstance: Auth,
  email: string,
  password: string
): Promise<void> {
  try {
    await createUserWithEmailAndPassword(authInstance, email, password);
  } catch (error) {
    console.error('Email sign-up failed:', error);
    throw error;
  }
}

export async function initiateEmailSignIn(
  authInstance: Auth,
  email: string,
  password: string
): Promise<void> {
  try {
    await signInWithEmailAndPassword(authInstance, email, password);
  } catch (error) {
    console.error('Email sign-in failed:', error);
    throw error;
  }
}