import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink,
  KeyRound,
  Sparkles,
  HelpCircle,
  Clock,
  ChevronRight
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { triggerAutoPasswordReset } from './lib/EmailService';

interface ForgotPasswordPageProps {
  onBack?: () => void;
  initialEmail?: string;
  onSuccess?: () => void;
}

// Logo helper matching app branding
const IMChatLogo = ({ className = "w-10 h-10 object-contain" }: { className?: string }) => {
  const originalLogoUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQBJVFxs5w38N3KpXM8ed1fHT_uBoz97uc8gU7VUGnpEDrhFiIq_f0zob3dweIVTEaF_8Opge3uX_Ed1QVh2ADZCcnyZ2xXwPIX9Nl089uWBxZAjqr0jgSfr6DBReyZKmeyI_6MFuS0RajgWyg0_K2ijPWrtk6VsSo5waSR9HOtf-4hs4BMwtwPh6g6vk/s1600/9519a766-e328-404a-b18e-7b7b6d029a15-removebg-preview~2.png';
  const logoSrc = (typeof window !== 'undefined' && localStorage.getItem('logoPreview')) || originalLogoUrl;
  return (
    <img 
      src={logoSrc} 
      className={className} 
      alt="IMChat Logo" 
      referrerPolicy="no-referrer"
    />
  );
};

export const maskEmailAddress = (rawEmail: string): string => {
  if (!rawEmail || !rawEmail.includes('@')) return rawEmail || '';
  const [local, domain] = rawEmail.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
};

export default function ForgotPasswordPage({
  onBack,
  initialEmail = '',
  onSuccess
}: ForgotPasswordPageProps) {
  const [inputValue, setInputValue] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // Handle countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const resolveTargetEmail = async (rawInput: string): Promise<string> => {
    const clean = rawInput.trim();
    if (!clean) throw new Error('Please enter your registered email address or username.');

    if (clean.includes('@')) {
      return clean.toLowerCase();
    }

    // Lookup username in Firestore
    const cleanUsername = clean.startsWith('@') ? clean.slice(1).toLowerCase() : clean.toLowerCase();
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', cleanUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const uData = snap.docs[0].data();
        if (uData.email) {
          return uData.email.toLowerCase();
        }
      }
    } catch (e) {
      console.warn("Could not query users collection by username:", e);
    }

    // Check local community users cache or throw
    throw new Error(`No account found matching username "@${cleanUsername}". Please provide your registered email address instead.`);
  };

  const handleSendReset = async (targetEmailParam?: string) => {
    setError(null);
    const toReset = targetEmailParam || inputValue;
    if (!toReset.trim()) {
      setError('Please provide your email address or username.');
      return;
    }

    setLoading(true);
    try {
      const resolvedEmail = await resolveTargetEmail(toReset);

      // Real Firebase Password Reset Email
      try {
        await sendPasswordResetEmail(auth, resolvedEmail);
      } catch (fbErr: any) {
        console.warn("Firebase sendPasswordResetEmail notice:", fbErr.message);
        if (fbErr.code === 'auth/user-not-found') {
          throw new Error('No account found with that email address. Please verify spelling or sign up.');
        } else if (fbErr.code === 'auth/invalid-email') {
          throw new Error('Please enter a valid email address.');
        } else if (fbErr.code === 'auth/too-many-requests') {
          throw new Error('Too many requests. Please wait a few moments before trying again.');
        }
      }

      // Automated backup recovery email & security logging
      try {
        await triggerAutoPasswordReset(resolvedEmail, 1);
      } catch (mailErr) {
        console.warn("Auto password reset backup notification error:", mailErr);
      }

      setSentEmail(resolvedEmail);
      setSuccess(true);
      setCooldown(60);
      onSuccess?.();
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(err.message || 'Unable to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || !sentEmail) return;
    setResending(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, sentEmail);
      await triggerAutoPasswordReset(sentEmail, 2);
      setCooldown(60);
    } catch (err: any) {
      console.error("Resend reset error:", err);
      setError('Could not resend email at this time. Please wait a few seconds.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans selection:bg-[#1da1f2]/20">
      
      {/* Top Navigation Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <IMChatLogo className="w-9 h-9" />
          <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            IMChat
          </span>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-slate-200/80 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>
        )}
      </header>

      {/* Main Core Form Container */}
      <main className="max-w-md w-full mx-auto my-auto py-6 sm:py-8">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 backdrop-blur-xs relative overflow-hidden">
          
          {/* Subtle Accent Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#1da1f2]/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {!success ? (
            /* STATE 1: Enter Email / Username */
            <div>
              <div className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#1da1f2]/10 border border-[#1da1f2]/20 flex items-center justify-center text-[#1da1f2] mb-4 shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
                  Forgot Password?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                  No worries! Enter your registered email address or username and we'll send you a secure link to reset your password.
                </p>
              </div>

              {error && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-3.5 mb-5 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-medium animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReset();
                }} 
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label htmlFor="reset_input_field" className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                    Email Address or Username
                  </label>
                  <div className="relative">
                    <input
                      id="reset_input_field"
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="e.g. alex@example.com or @alex"
                      className="w-full pl-3.5 pr-10 py-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1da1f2] focus:ring-2 focus:ring-[#1da1f2]/20 rounded-2xl outline-none text-sm text-slate-900 placeholder-slate-400 font-medium transition-all shadow-xs"
                      disabled={loading}
                      required
                      autoFocus
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    We'll look up your account and dispatch a verified reset token.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !inputValue.trim()}
                  className="w-full py-3.5 px-4 bg-[#1da1f2] hover:bg-[#1991db] text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-[#1da1f2]/25 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Security highlights */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-3 text-xs text-slate-500">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Your security is our priority. Reset links expire within <strong>1 hour</strong> and can only be used once.
                </p>
              </div>

              {onBack && (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={onBack}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* STATE 2: Success Confirmation */
            <div className="text-center py-2 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-sm animate-bounce-subtle">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
                Check Your Email
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-sm mx-auto mb-4">
                We've sent password reset instructions to:
              </p>

              <div className="inline-block bg-slate-100/90 border border-slate-200 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-800 mb-6 font-mono tracking-tight">
                {maskEmailAddress(sentEmail)}
              </div>

              {/* Webmail Quick Access Shortcuts */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 mb-5 text-left">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Quick Access to Inbox
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-2 bg-white hover:bg-slate-100/80 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs"
                  >
                    <span>Gmail</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                  <a
                    href="https://outlook.live.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-2 bg-white hover:bg-slate-100/80 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs"
                  >
                    <span>Outlook</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                  <a
                    href="https://mail.yahoo.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-2 bg-white hover:bg-slate-100/80 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs"
                  >
                    <span>Yahoo</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Resend actions */}
              <div className="flex flex-col items-center gap-2 mb-6">
                <button
                  type="button"
                  disabled={cooldown > 0 || resending}
                  onClick={handleResend}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1da1f2] hover:text-[#1991db] disabled:text-slate-400 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? (
                    <span>Resend email in {cooldown}s</span>
                  ) : (
                    <span>Resend reset email</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setInputValue('');
                    setError(null);
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors underline cursor-pointer"
                >
                  Use a different email address
                </button>
              </div>

              {/* Troubleshooting Accordion */}
              <div className="text-left border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    Didn't receive the email?
                  </span>
                  <span className="text-[11px] text-[#1da1f2]">{showTroubleshoot ? 'Hide' : 'Tips'}</span>
                </button>

                {showTroubleshoot && (
                  <ul className="mt-3 space-y-1.5 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 animate-fade-in">
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-slate-700">•</span>
                      <span>Check your <strong>Spam</strong>, <strong>Junk</strong>, or <strong>Promotions</strong> folders.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-slate-700">•</span>
                      <span>Ensure your email address was typed accurately without typos.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="font-bold text-slate-700">•</span>
                      <span>It may take a couple of minutes for high-volume email servers to deliver.</span>
                    </li>
                  </ul>
                )}
              </div>

              {onBack && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onBack}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] font-medium text-slate-400 mt-6">
          © {new Date().getFullYear()} IMChat Inc. All rights reserved. Secure Cloud Authentication.
        </p>
      </main>

      <footer className="text-center text-xs text-slate-400 py-2 hidden sm:block">
        Need immediate assistance? Contact our security support at support@imchat.internal
      </footer>
    </div>
  );
}
