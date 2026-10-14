import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, SwitchCamera, Zap, ZapOff, Upload, QrCode, UserPlus, UserCheck, MessageSquare, ExternalLink, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import jsQR from 'jsqr';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import UserAvatar from './UserAvatar';
import { User as UserModel } from '../UserProfile';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser?: (user: UserModel) => void;
  onToggleFollow?: (userId: string) => void;
  followingState?: Record<string, boolean>;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  onToggleFollow,
  followingState = {},
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [scannedUser, setScannedUser] = useState<UserModel | null>(null);
  const [scannedRawText, setScannedRawText] = useState<string | null>(null);
  const [isFollowingLocally, setIsFollowingLocally] = useState(false);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser or context.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() || {}) as any;
        setHasTorch(!!capabilities.torch);
      }

      setIsScanning(true);
    } catch (err: any) {
      console.error('QR Scanner camera error:', err);
      let message = 'Unable to access camera. Please allow camera permissions or upload an image instead.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission denied. Please grant permission in your browser settings to scan QR codes.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera device found on this device.';
      }
      setCameraError(message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextTorch = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setIsTorchOn(nextTorch);
      } catch (e) {
        console.warn('Torch toggle failed', e);
      }
    }
  };

  // Toggle Front/Back Camera
  const toggleCameraFacing = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Parse QR content to extract user ID or username
  const parseQRContent = (text: string): { userId?: string; username?: string } => {
    const trimmed = text.trim();

    // Check if JSON payload
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.userId || parsed.id) return { userId: parsed.userId || parsed.id };
      if (parsed.username) return { username: parsed.username };
    } catch {
      // not JSON
    }

    // Check if URL
    try {
      const url = new URL(trimmed);
      const profileParam = url.searchParams.get('profile') || url.searchParams.get('user') || url.searchParams.get('u');
      if (profileParam) return { userId: profileParam };

      // Check pathname (e.g. /user/xyz or /profile/xyz)
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && (parts[0] === 'user' || parts[0] === 'profile')) {
        return { userId: parts[1] };
      }
    } catch {
      // not a full URL
    }

    // Check for query param substring in raw string
    const match = trimmed.match(/[?&](?:profile|user|u)=([^&#\s]+)/i);
    if (match && match[1]) {
      return { userId: decodeURIComponent(match[1]) };
    }

    // Check for imchat:// or @username
    if (trimmed.startsWith('@')) {
      return { username: trimmed.substring(1) };
    }

    // Fallback: assume raw text is a userId / UID
    if (/^[a-zA-Z0-9_-]{8,40}$/.test(trimmed)) {
      return { userId: trimmed };
    }

    return { userId: trimmed };
  };

  // Resolve Profile Info from DB
  const resolveProfile = async (qrData: string) => {
    setIsScanning(false);
    setIsLoadingProfile(true);
    setScannedRawText(qrData);

    // Haptic feedback if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 60, 40]); } catch {}
    }

    const { userId, username } = parseQRContent(qrData);

    let resolvedUser: UserModel | null = null;

    try {
      if (userId) {
        // Look up by doc ID
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          resolvedUser = {
            id: docSnap.id,
            name: data.name || data.displayName || 'IMChat User',
            username: data.username || data.name?.toLowerCase().replace(/\s+/g, '') || '',
            avatar: data.avatar || data.profileImg || data.photoURL || '',
            bio: data.bio || '',
            isVerified: data.isVerified || false,
            role: data.role || 'user',
            city: data.city || '',
            isBusinessAccount: data.isBusinessAccount || false,
          };
        }
      }

      if (!resolvedUser && username) {
        // Query by username field
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const uDoc = snap.docs[0];
          const data = uDoc.data();
          resolvedUser = {
            id: uDoc.id,
            name: data.name || data.displayName || username,
            username: data.username || username,
            avatar: data.avatar || data.profileImg || data.photoURL || '',
            bio: data.bio || '',
            isVerified: data.isVerified || false,
            role: data.role || 'user',
            city: data.city || '',
            isBusinessAccount: data.isBusinessAccount || false,
          };
        }
      }

      // Fallback if not found in database: create synthetic user object so the user can still connect
      if (!resolvedUser) {
        const fallbackId = userId || 'user_' + Math.random().toString(36).substring(2, 8);
        resolvedUser = {
          id: fallbackId,
          name: username ? `@${username}` : (userId ? `User (${userId.slice(0, 8)}...)` : 'Scanned Contact'),
          username: username || '',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fallbackId}`,
          bio: 'IMChat profile scanned via QR code',
          isVerified: false,
          role: 'user'
        };
      }

      setScannedUser(resolvedUser);
      setIsFollowingLocally(!!followingState[resolvedUser.id]);
    } catch (err) {
      console.error('Error resolving scanned user:', err);
      setScannedUser({
        id: userId || 'unknown_user',
        name: 'Scanned User',
        avatar: '',
        bio: 'IMChat Contact',
        isVerified: false,
      });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Continuous frame scanning loop
  const scanLoop = () => {
    if (!isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          resolveProfile(code.data);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(scanLoop);
  };

  // Start stream when opened or when facing mode changes
  useEffect(() => {
    if (isOpen) {
      setScannedUser(null);
      setScannedRawText(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Handle continuous loop when camera is active and ready
  useEffect(() => {
    if (isOpen && isScanning && !cameraError) {
      animationFrameId.current = requestAnimationFrame(scanLoop);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isOpen, isScanning, cameraError]);

  // Handle image upload scanning
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            resolveProfile(code.data);
          } else {
            alert('No valid QR code found in this image. Please ensure the QR code is clear and well-lit.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleToggleFollow = () => {
    if (!scannedUser) return;
    const next = !isFollowingLocally;
    setIsFollowingLocally(next);
    onToggleFollow?.(scannedUser.id);
  };

  const handleOpenProfile = () => {
    if (!scannedUser) return;
    onClose();
    if (onSelectUser) {
      onSelectUser(scannedUser);
    } else {
      window.dispatchEvent(new CustomEvent('navigate-to-user', { detail: scannedUser }));
    }
  };

  const handleStartChat = () => {
    if (!scannedUser) return;
    onClose();
    window.dispatchEvent(
      new CustomEvent('start-chat', {
        detail: {
          id: scannedUser.id,
          name: scannedUser.name,
          avatar: scannedUser.avatar || '',
        },
      })
    );
  };

  const handleScanAgain = () => {
    setScannedUser(null);
    setScannedRawText(null);
    setIsScanning(true);
    startCamera();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      >
        {/* Backdrop click */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <QrCode className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white tracking-tight">Scan Profile QR Code</h3>
                <p className="text-[11px] text-slate-400">Point your camera to instantly follow</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Section */}
          <div className="p-5 flex flex-col items-center">
            {/* Scanned Profile Result Card */}
            {scannedUser ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full bg-slate-800/90 rounded-2xl p-5 border border-purple-500/30 flex flex-col items-center text-center shadow-lg"
              >
                <div className="relative mb-3">
                  <div className="p-1 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500">
                    <UserAvatar
                      src={scannedUser.avatar}
                      name={scannedUser.name}
                      size="lg"
                      className="!w-20 !h-20 border-2 border-slate-900"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-slate-900 shadow">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 justify-center">
                  <h4 className="font-bold text-base text-white">{scannedUser.name}</h4>
                  {scannedUser.isVerified && (
                    <span className="bg-[#0095f6] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      ✓
                    </span>
                  )}
                </div>

                {scannedUser.username && (
                  <p className="text-xs text-purple-300 font-medium mt-0.5">@{scannedUser.username}</p>
                )}

                {scannedUser.bio && (
                  <p className="text-xs text-slate-300 mt-2 px-2 line-clamp-2 leading-relaxed">
                    {scannedUser.bio}
                  </p>
                )}

                {/* Primary Follow Button */}
                <div className="w-full mt-5 flex flex-col gap-2.5">
                  <button
                    onClick={handleToggleFollow}
                    className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                      isFollowingLocally
                        ? 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                        : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/40'
                    }`}
                  >
                    {isFollowingLocally ? (
                      <>
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        <span>Following Profile</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Follow Instantly</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleOpenProfile}
                      className="py-2.5 px-3 bg-slate-700/70 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-600/60 active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Profile</span>
                    </button>

                    <button
                      onClick={handleStartChat}
                      className="py-2.5 px-3 bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 hover:text-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-purple-500/30 active:scale-95"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Send Chat</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleScanAgain}
                  className="mt-4 text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors py-1 px-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan another QR code</span>
                </button>
              </motion.div>
            ) : cameraError ? (
              /* Camera Error & Fallback UI */
              <div className="w-full py-8 px-4 flex flex-col items-center text-center bg-slate-800/60 rounded-2xl border border-slate-700">
                <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30 mb-3">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm text-white mb-1.5">Camera Unavailable</h4>
                <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">{cameraError}</p>

                <div className="flex flex-col gap-2.5 w-full max-w-xs">
                  <button
                    onClick={startCamera}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Try Camera Again</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 border border-slate-600"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload QR Screenshot</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Live Camera Viewfinder */
              <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden bg-black border-2 border-slate-700 shadow-2xl flex items-center justify-center">
                {/* Live Video Feed */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {/* Hidden processing canvas */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Target Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-48 h-48 border-2 border-purple-400/80 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                    {/* Viewfinder Corner Brackets */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />

                    {/* Animated Scanning Laser Line */}
                    <motion.div
                      animate={{
                        top: ['5%', '90%', '5%'],
                        opacity: [0.7, 1, 0.7],
                      }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_10px_#a855f7]"
                    />
                  </div>
                </div>

                {/* Loading state indicator */}
                {isLoadingProfile && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 z-10">
                    <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      Identifying Profile...
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Camera Controls Toolbar (when camera active) */}
            {!scannedUser && !cameraError && (
              <div className="flex items-center justify-center gap-3 mt-4 w-full">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-3 rounded-2xl transition-all active:scale-95 border ${
                      isTorchOn
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                    title={isTorchOn ? 'Turn Flash Off' : 'Turn Flash On'}
                  >
                    {isTorchOn ? <Zap className="w-5 h-5 fill-amber-300" /> : <ZapOff className="w-5 h-5" />}
                  </button>
                )}

                <button
                  onClick={toggleCameraFacing}
                  className="p-3 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all active:scale-95"
                  title="Flip Camera (Front/Back)"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-2xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                  title="Choose QR Code from Gallery"
                >
                  <Upload className="w-4 h-4" />
                  <span>From Photos</span>
                </button>
              </div>
            )}

            {/* Hidden image input for gallery fallback */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFile}
            />
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Supports all IMChat profile QR codes</span>
            </span>
            <button
              onClick={onClose}
              className="text-xs text-slate-300 hover:text-white font-semibold px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
