import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  X, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Lock, 
  User, 
  Plus, 
  Trash2, 
  ArrowRight,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BiometricAuthService, BiometricProfile } from '../lib/BiometricAuth';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface FingerprintLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialEmail?: string;
}

export default function FingerprintLoginModal({
  isOpen,
  onClose,
  onSuccess,
  initialEmail = ''
}: FingerprintLoginModalProps) {
  const [profiles, setProfiles] = useState<BiometricProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BiometricProfile | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error' | 'enroll'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Enrollment Form State
  const [enrollEmail, setEnrollEmail] = useState(initialEmail);
  const [enrollPassword, setEnrollPassword] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Load enrolled profiles on open
  useEffect(() => {
    if (isOpen) {
      const list = BiometricAuthService.getEnrolledProfiles();
      setProfiles(list);
      setErrorMessage('');
      
      let initialSelected = null;
      if (initialEmail && list.length > 0) {
        initialSelected = list.find(p => p.email.toLowerCase() === initialEmail.toLowerCase().trim()) || null;
      }
      if (!initialSelected && list.length > 0) {
        initialSelected = BiometricAuthService.getLastEnrolledProfile() || list[0];
      }
      setSelectedProfile(initialSelected);

      if (list.length === 0) {
        setStatus('enroll');
        setStatusMessage('No fingerprint registered on this device yet. Enter your credentials once to enroll.');
      } else {
        setStatus('idle');
        setStatusMessage('Ready for biometric scan. Touch the sensor or click Scan.');
      }
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleStartBiometricScan = async (profileToVerify?: BiometricProfile) => {
    const target = profileToVerify || selectedProfile;
    if (!target) {
      setStatus('enroll');
      setStatusMessage('Please enroll your account to enable fingerprint sign in.');
      return;
    }

    setStatus('scanning');
    setErrorMessage('');
    setStatusMessage('Scanning fingerprint... Touch your device biometric sensor now.');

    try {
      const result = await BiometricAuthService.verifyFingerprint(target.email);
      
      setStatus('success');
      setStatusMessage('Biometric identity confirmed! Authenticating your session...');

      // Complete sign in with Firebase Auth
      let emailToSign = result.profile.email;
      let passwordToSign = result.password;

      // If username was stored instead of email, resolve email
      if (!emailToSign.includes('@')) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', emailToSign.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const u = snap.docs[0].data();
          if (u.email) emailToSign = u.email;
        }
      }

      if (passwordToSign) {
        await signInWithEmailAndPassword(auth, emailToSign, passwordToSign);
      }

      // Record biometric sign-in in Firestore
      if (auth.currentUser) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            hasBiometricEnabled: true,
            lastBiometricLogin: serverTimestamp()
          });
        } catch (e) {
          console.warn("Firestore biometric update note:", e);
        }
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);

    } catch (err: any) {
      console.error("Biometric verification failed:", err);
      setStatus('error');
      const msg = err.message || 'Fingerprint verification failed. Please try again or sign in with your password.';
      setErrorMessage(msg);
      setStatusMessage(msg);
    }
  };

  const handleEnrollNewFingerprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollEmail || !enrollPassword) {
      setErrorMessage('Please enter both your email/username and password to enroll fingerprint.');
      return;
    }

    setIsEnrolling(true);
    setErrorMessage('');
    setStatus('scanning');
    setStatusMessage('Verifying credentials & registering fingerprint on your device...');

    try {
      let emailToUse = enrollEmail.trim().toLowerCase();
      let usernameToUse = '';
      let displayNameToUse = '';
      let avatarToUse = '';

      // If username provided, find email
      if (!emailToUse.includes('@')) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', emailToUse));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const uData = snap.docs[0].data();
          usernameToUse = uData.username || emailToUse;
          displayNameToUse = uData.name || '';
          avatarToUse = uData.avatar || '';
          if (uData.email) emailToUse = uData.email.toLowerCase();
        } else {
          throw new Error('No user found with this username. Please check your username.');
        }
      }

      // 1. Authenticate with Firebase
      const cred = await signInWithEmailAndPassword(auth, emailToUse, enrollPassword);
      const user = cred.user;

      // 2. Register WebAuthn / Biometric on hardware platform
      const { profile } = await BiometricAuthService.enrollFingerprint({
        userId: user.uid,
        email: emailToUse,
        displayName: displayNameToUse || user.displayName || emailToUse.split('@')[0],
        username: usernameToUse,
        avatar: avatarToUse || user.photoURL || '',
        password: enrollPassword
      });

      // 3. Mark biometric enabled on user document
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          hasBiometricEnabled: true,
          biometricEnabledAt: serverTimestamp(),
          lastBiometricLogin: serverTimestamp()
        });
      } catch (e) {
        console.warn("Firestore update biometric note:", e);
      }

      setStatus('success');
      setStatusMessage('Fingerprint successfully enrolled and linked to your account!');

      // Refresh list
      const updatedList = BiometricAuthService.getEnrolledProfiles();
      setProfiles(updatedList);
      setSelectedProfile(profile);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);

    } catch (err: any) {
      console.error("Fingerprint enrollment failed:", err);
      setStatus('error');
      let msg = err.message || 'Failed to enroll fingerprint.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid password for this account. Please re-enter your password to link your fingerprint.';
      }
      setErrorMessage(msg);
      setStatusMessage(msg);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRemoveProfile = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    if (confirm("Remove this enrolled fingerprint from this device?")) {
      BiometricAuthService.removeEnrollment(profileId);
      const updated = BiometricAuthService.getEnrolledProfiles();
      setProfiles(updated);
      if (selectedProfile?.userId === profileId) {
        setSelectedProfile(updated.length > 0 ? updated[0] : null);
        if (updated.length === 0) {
          setStatus('enroll');
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col relative"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner">
              <Fingerprint className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Fingerprint Quick Login</span>
                <Sparkles className="w-4 h-4 text-amber-300" />
              </h2>
              <p className="text-xs text-blue-100 font-medium">Touch ID, Windows Hello & Biometric Auth</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Active Status Display */}
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </motion.div>
          )}

          {status === 'enroll' ? (
            /* Enrollment View */
            <div className="space-y-4">
              <div className="text-center p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <Smartphone className="w-7 h-7 text-blue-600 mx-auto mb-1.5" />
                <h3 className="text-sm font-extrabold text-slate-800">Enroll Fingerprint on this Device</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Sign in once to register and link your biometric sensor for instant 1-tap logins.
                </p>
              </div>

              <form onSubmit={handleEnrollNewFingerprint} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                    Email Address or Username
                  </label>
                  <input
                    type="text"
                    value={enrollEmail}
                    onChange={(e) => setEnrollEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                    Account Password
                  </label>
                  <input
                    type="password"
                    value={enrollPassword}
                    onChange={(e) => setEnrollPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isEnrolling}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isEnrolling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enrolling Fingerprint...</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-4 h-4" />
                        <span>Enroll & Enable Fingerprint</span>
                      </>
                    )}
                  </button>

                  {profiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatus('idle');
                        setErrorMessage('');
                      }}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            /* Fingerprint Scan Verification View */
            <div className="space-y-5">
              
              {/* Selected Profile Card */}
              {selectedProfile && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm border border-blue-200 overflow-hidden shrink-0">
                      {selectedProfile.avatar ? (
                        <img src={selectedProfile.avatar} alt="User avatar" className="w-full h-full object-cover" />
                      ) : (
                        selectedProfile.displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                        <span>{selectedProfile.displayName}</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        {selectedProfile.email}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    Enrolled
                  </span>
                </div>
              )}

              {/* Central Biometric Touch Scanner Visualizer */}
              <div className="py-2 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  {/* Pulsing Animated Rings */}
                  <motion.div 
                    animate={status === 'scanning' ? { scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] } : { scale: 1, opacity: 0.2 }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                    className="absolute inset-[-14px] rounded-full bg-blue-500/20 pointer-events-none"
                  />
                  <motion.div 
                    animate={status === 'scanning' ? { scale: [1, 1.45, 1], opacity: [0.2, 0.5, 0.2] } : { scale: 1, opacity: 0.1 }}
                    transition={{ repeat: Infinity, duration: 1.6, delay: 0.3 }}
                    className="absolute inset-[-28px] rounded-full bg-indigo-500/10 pointer-events-none"
                  />

                  {/* Fingerprint Touch Button */}
                  <button
                    type="button"
                    onClick={() => handleStartBiometricScan(selectedProfile || undefined)}
                    disabled={status === 'scanning'}
                    className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative shadow-xl overflow-hidden cursor-pointer ${
                      status === 'success'
                        ? 'bg-emerald-600 text-white scale-105 shadow-emerald-500/30'
                        : status === 'scanning'
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/40 ring-4 ring-blue-300'
                        : 'bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-800 hover:from-blue-600 hover:to-indigo-600 text-white shadow-slate-900/20 active:scale-95'
                    }`}
                  >
                    {/* Laser scan bar effect */}
                    {status === 'scanning' && (
                      <motion.div
                        animate={{ y: [-40, 40, -40] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                        className="absolute inset-x-0 h-1 bg-cyan-300 shadow-[0_0_12px_#38bdf8] z-20"
                      />
                    )}

                    {status === 'success' ? (
                      <CheckCircle2 className="w-12 h-12 animate-bounce" />
                    ) : status === 'scanning' ? (
                      <Fingerprint className="w-12 h-12 animate-pulse" />
                    ) : (
                      <Fingerprint className="w-12 h-12" />
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <p className={`text-xs font-black uppercase tracking-wider ${
                    status === 'success' ? 'text-emerald-700' : status === 'scanning' ? 'text-blue-600' : 'text-slate-800'
                  }`}>
                    {status === 'success' ? '✓ Biometric Verified' : status === 'scanning' ? 'Scanning Fingerprint...' : 'Tap Sensor to Authenticate'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium max-w-xs">
                    {statusMessage || 'Touch the fingerprint sensor on your phone, laptop, or keyboard.'}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={status === 'scanning'}
                onClick={() => handleStartBiometricScan(selectedProfile || undefined)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {status === 'scanning' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Hardware Sensor...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    <span>Scan Fingerprint & Sign In</span>
                  </>
                )}
              </button>

              {/* Multiple Enrolled Accounts List (if more than 1) */}
              {profiles.length > 1 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Switch Enrolled Account
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {profiles.map(p => (
                      <div
                        key={p.userId}
                        onClick={() => setSelectedProfile(p)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                          selectedProfile?.userId === p.userId
                            ? 'bg-blue-50/80 border-blue-200 font-bold text-blue-900'
                            : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate">{p.displayName} ({p.email})</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveProfile(e, p.userId)}
                          title="Remove from device"
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Option to enroll a new account */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStatus('enroll');
                    setEnrollEmail('');
                    setEnrollPassword('');
                    setErrorMessage('');
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enroll another account</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  Use Password Instead
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer Security Badge */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>FIDO2 / WebAuthn Biometric Standard</span>
          </div>
          <span className="text-slate-500 font-bold">256-bit Encrypted</span>
        </div>
      </motion.div>
    </div>
  );
}
