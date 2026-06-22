import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  src?: string;
  name?: string;
  className?: string;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function UserAvatar({ src, name, className = '', onClick, size = 'md' }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-[102px] h-[102px] text-4xl',
  };

  const baseClasses = `rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden ${sizeClasses[size]} ${className}`;

  const isVideo = src && (src.toLowerCase().endsWith('.mp4') || src.includes('.mp4?') || src.toLowerCase().includes('video/mp4') || src.startsWith('data:video/mp4'));

  if (!src || imageFailed) {
    return (
      <div 
        id="avatar_silhouette_fallback" 
        className={`${baseClasses} bg-gray-200 text-gray-500 flex items-center justify-center select-none shadow-sm border border-white/20`} 
        onClick={onClick}
      >
        <User className="w-1/2 h-1/2 stroke-[1.75]" />
      </div>
    );
  }

  return (
    <div className={baseClasses} onClick={onClick}>
      {isVideo ? (
        <video 
          src={src} 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover" 
          onError={() => setImageFailed(true)}
        />
      ) : (
        <img 
          src={src} 
          alt={name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => {
             setImageFailed(true);
          }}
        />
      )}
    </div>
  );
}
