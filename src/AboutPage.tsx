import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Info, 
  Sparkles,
  Globe2,
  Clock,
  Heart
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from './lib/i18n';

interface AboutPageProps {
  onBack: () => void;
}

export default function AboutPage({ onBack }: AboutPageProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { t } = useLanguage();

  const companyInfo = {
    name: 'IMChat inc',
    address: 'South Africa 103 Morning Side Kampara estate, Durban 4001, 158 Florida Rd',
    contactNumber: '0818009307',
    formattedPhone: '+27 81 800 9307',
    email: 'Contact@imchat.im',
    website: 'https://imchat.im',
    version: 'v2.8.4 Pro',
    founded: '2024',
    jurisdiction: 'Republic of South Africa'
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  return (
    <div className="absolute inset-0 z-[60] bg-[#f8fafc] flex flex-col overflow-hidden text-slate-800">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-slate-100 rounded-full transition-colors active:scale-95 text-slate-700"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">About IMChat</h1>
            <span className="text-[11px] text-slate-500 font-medium">Company Profile & Contact Information</span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-brand-blue/10 text-brand-blue px-2.5 py-1 rounded-full text-xs font-bold border border-brand-blue/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{companyInfo.version}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-16">
          
          {/* Hero Branding Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#2EA6FF] via-[#1a8cd8] to-[#0d6efd] rounded-3xl p-6 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden"
          >
            {/* Background Decorative Rings */}
            <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute right-12 top-4 w-20 h-20 bg-white/10 rounded-full blur-md pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md p-2.5 shadow-inner border border-white/30 flex items-center justify-center shrink-0">
                <img 
                  src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEimMOI9p_Y95MXwhBKpOWMPBp2psL5Vg8IdqlHF5w_yYXZr5PdhwldwKWTyiJnL1IP2fcQLll94mQk_Ei_nAd1A7mSWk3Dh-tScDQ85N1Kr_kkyXz1PbgfySfptCRcUO17gz0eomvyQNjSF3b1Lf9yQi70xCtnnDaDcIptI4U2PtLxAg-R3_46rLpOLLqo/s300/7420ae07a59f2687218ebf9caa4d8a5f.gif" 
                  alt="IMChat Mascot"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold tracking-wide uppercase mb-1 border border-white/20">
                  <Building2 className="w-3 h-3" />
                  Official Corporate Profile
                </div>
                <h2 className="text-2xl font-black tracking-tight drop-shadow-xs">{companyInfo.name}</h2>
                <p className="text-blue-100 text-xs sm:text-sm mt-1 leading-relaxed max-w-md">
                  Global social discovery, real-time multimedia messaging, and digital community infrastructure connecting people worldwide.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Quick Contact & Verified Credentials Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Phone Card */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0 group-hover:scale-105 transition-transform">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Contact Number</span>
                    <span className="text-sm font-bold text-slate-900">{companyInfo.contactNumber}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(companyInfo.contactNumber, 'phone')}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                  title="Copy Contact Number"
                >
                  {copiedField === 'phone' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <a 
                  href={`tel:${companyInfo.contactNumber}`} 
                  className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg text-center transition-colors flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call Direct
                </a>
                <a 
                  href={`https://wa.me/27${companyInfo.contactNumber.replace(/^0/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg text-center transition-colors"
                >
                  WhatsApp
                </a>
              </div>
            </motion.div>

            {/* Email Card */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0 group-hover:scale-105 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Official Email</span>
                    <span className="text-sm font-bold text-slate-900 break-all">{companyInfo.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(companyInfo.email, 'email')}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                  title="Copy Email"
                >
                  {copiedField === 'email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <a 
                  href={`mailto:${companyInfo.email}`} 
                  className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg text-center transition-colors flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Send Official Email
                </a>
              </div>
            </motion.div>
          </div>

          {/* Physical Address Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Headquarters Address</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                    {companyInfo.address}
                  </p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                    📍 Durban, KwaZulu-Natal, South Africa
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleCopy(companyInfo.address, 'address')}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors shrink-0"
                title="Copy Address"
              >
                {copiedField === 'address' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Operating Hours: Mon - Fri (08:00 - 17:00 SAST)</span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('158 Florida Rd, Morningside, Durban, 4001, South Africa')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-blue hover:text-blue-700 hover:underline"
              >
                <span>View on Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>

          {/* Corporate Details & Compliance Overview */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-brand-blue" />
              <h3 className="text-sm font-bold text-slate-900">Corporate Governance & Compliance</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-semibold block text-[11px]">Legal Entity</span>
                <span className="font-bold text-slate-900 text-[13px]">{companyInfo.name}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-semibold block text-[11px]">Country of Registration</span>
                <span className="font-bold text-slate-900 text-[13px]">{companyInfo.jurisdiction}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-semibold block text-[11px]">Data Privacy Framework</span>
                <span className="font-bold text-slate-900 text-[13px]">POPIA & GDPR Compliant</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-600 font-semibold block text-[11px]">Security Infrastructure</span>
                <span className="font-bold text-slate-900 text-[13px]">End-to-End Encrypted Storage</span>
              </div>
            </div>
          </motion.div>

          {/* Mission & Product Statement */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-lg space-y-3"
          >
            <div className="flex items-center gap-2 text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">About Our Platform</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              IMChat is built to empower real connections with ultra-fast instant messaging, high-fidelity media sharing, live channels, real-time voice and video communication, and creator tools. 
            </p>
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-700/60">
              <span className="flex items-center gap-1">
                <Globe2 className="w-3.5 h-3.5" />
                Global Access • Durban, South Africa
              </span>
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                Made with <Heart className="w-3 h-3 text-red-500 fill-red-500 inline" /> for community
              </span>
            </div>
          </motion.div>

          {/* Footer copyright */}
          <div className="text-center pt-2 space-y-1 text-slate-600 text-xs">
            <p>© {new Date().getFullYear()} {companyInfo.name}. All rights reserved.</p>
            <p className="text-[11px] text-slate-500">Authorized telecommunications & software enterprise.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
