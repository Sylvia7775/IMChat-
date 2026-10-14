import { auth, db } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export interface WelcomeEmailPayload {
  email: string;
  name?: string;
  username?: string;
  userId?: string;
}

/**
 * Triggers the automated welcome email to a new or verified user.
 * Dispatches via the backend /api/send-welcome-email endpoint and logs the event.
 */
export async function triggerWelcomeEmail(payload: WelcomeEmailPayload): Promise<{ success: boolean; message: string; status?: string }> {
  if (!payload.email || !payload.email.includes('@')) {
    return { success: false, message: 'A valid email address is required.' };
  }

  // Prevent duplicate spamming for same session/user if recently sent
  const cacheKey = `welcome_email_sent_${payload.email.toLowerCase()}`;
  if (sessionStorage.getItem(cacheKey)) {
    return { success: true, message: 'Welcome email was already dispatched recently.' };
  }

  try {
    const response = await fetch('/api/send-welcome-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payload.email.trim(),
        name: payload.name || 'Friend',
        username: payload.username || 'user',
        userId: payload.userId || (auth.currentUser ? auth.currentUser.uid : null),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with ${response.status}`);
    }

    const data = await response.json();
    sessionStorage.setItem(cacheKey, 'true');

    // Also record local log in firestore if user is logged in
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, 'email_activity_logs'), {
          type: 'welcome_email',
          recipient: payload.email,
          userId: auth.currentUser.uid,
          status: data.status || 'sent',
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        // silent catch
      }
    }

    return {
      success: true,
      message: data.message || 'Welcome email sent successfully!',
      status: data.status,
    };
  } catch (error: any) {
    console.warn('Could not dispatch welcome email via backend API:', error.message);
    // Soft fallback so onboarding is never interrupted
    return {
      success: false,
      message: error.message || 'Failed to dispatch welcome email.',
    };
  }
}

/**
 * Test utility to send a preview or trial welcome email directly from Settings.
 */
export async function testWelcomeEmail(email: string, name = 'Valued User', username = 'vip_member'): Promise<{ success: boolean; message: string }> {
  return triggerWelcomeEmail({ email, name, username });
}

/**
 * Sends an automated password reset email securely using Firebase Authentication and logs recovery attempt.
 */
export async function triggerAutoPasswordReset(email: string, step = 1): Promise<{ success: boolean; message: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please provide a valid email address.' };
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
    return {
      success: true,
      message: `Password reset link dispatched to ${email}.`,
    };
  } catch (error: any) {
    console.warn('Password reset trigger:', error.message);
    return {
      success: false,
      message: error.message || 'Could not send password reset email.',
    };
  }
}

/**
 * Sends an automated password reset email securely using Firebase Authentication.
 */
export async function sendAutomatedPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  return triggerAutoPasswordReset(email);
}
