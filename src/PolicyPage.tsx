import React, { useEffect, useState } from 'react';
import { ArrowLeft, Shield, Check, Lock, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

interface PolicyPageProps {
  onBack: () => void;
}

export default function PolicyPage({ onBack }: PolicyPageProps) {
  const [visibleItems, setVisibleItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleItems((prev) => ({ ...prev, [entry.target.id]: true }));
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.reveal-on-scroll').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div id="policy-view-root" className="min-h-screen bg-[#0a0a0d] text-[#f3f1eb] font-sans antialiased selection:bg-[#d8ff62] selection:text-[#0a0a0d] relative overflow-x-hidden pb-16">
      {/* Background radial glow effects as designed in original policy CSS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] rounded-full bg-[#d8ff62]/[0.05] blur-[120px]" />
        <div className="absolute top-[10%] right-[20%] w-[350px] h-[350px] rounded-full bg-[#7cf2c9]/[0.06] blur-[100px]" />
        <div className="absolute bottom-[20%] left-[30%] w-[450px] h-[450px] rounded-full bg-white/[0.03] blur-[140px]" />
        
        {/* Subtle decorative grid overlay from the original CSS */}
        <div 
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            maskImage: 'radial-gradient(circle at center, black 45%, transparent 95%)'
          }}
        />
      </div>

      {/* Header Container */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0a0a0d]/80 border-b border-white/[0.06] transition-all">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-[76px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              id="policy-back-btn"
              onClick={onBack}
              className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/5 flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5 text-shadow" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl relative bg-gradient-to-br from-[#d8ff62]/25 to-[#7cf2c9]/15 border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden flex items-center justify-center">
                <div className="absolute w-[18px] h-[18px] left-[6px] top-[6px] rounded-full bg-[#d8ff62] opacity-90" />
                <div className="absolute w-[12px] h-[12px] right-[6px] bottom-[6px] rounded-full bg-[#7cf2c9]" />
              </div>
              <span className="font-bold tracking-wider text-white text-base font-display">IntegrityLock</span>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-6" aria-label="Policy sub navigation">
            <a href="#rules-section" className="text-[#b5b0a6] hover:text-[#f3f1eb] text-sm font-medium transition-colors">Protection</a>
            <a href="#safeguards-section" className="text-[#b5b0a6] hover:text-[#f3f1eb] text-sm font-medium transition-colors">Enforcement</a>
            <a href="#data-access" className="text-[#b5b0a6] hover:text-[#f3f1eb] text-sm font-medium transition-colors">Data Access</a>
          </nav>

          <a href="#rules-section" className="px-5 py-2 rounded-full border border-[#d8ff62]/30 text-[#0a0a0d] bg-gradient-to-r from-[#d8ff62] to-[#ffd3d3]/10 font-bold text-xs shadow-[0_10px_30px_rgba(216,255,98,0.25)] hover:translate-y-[-2px] transition-all cursor-pointer active:translate-y-0">
            View Policy
          </a>
        </div>
      </header>

      {/* Main Content Wrap */}
      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 relative z-10" id="top">
        
        {/* HERO SECTION */}
        <section className="pt-12 md:pt-20 pb-12 flex flex-col lg:grid lg:grid-columns-1.15fr_.85fr lg:grid-cols-[1.15fr_0.85fr] gap-8 items-end">
          {/* Hero text block */}
          <div className="flex flex-col gap-5 max-w-[650px] lg:max-w-none text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#b5b0a6] text-xs font-semibold uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-[#d8ff62] shadow-[0_0_0_6px_rgba(216,255,98,0.1)] shrink-0 animate-pulse" />
              Content integrity and user data protection
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-[5.4rem] font-bold tracking-tight text-white leading-[0.95] max-w-[15ch] font-display">
              Block deletion. Protect posts. Restrict harmful data access.
            </h1>

            <p className="text-[#b5b0a6] text-base sm:text-lg max-w-[55ch] leading-[1.6]">
              This interface presents a strict policy direction for preserving user comments, posts,
              pictures, and videos from automatic or unauthorized deletion, while denying data fetching
              whenever access could damage user content, files, or account integrity.
            </p>

            <div className="flex flex-wrap gap-4 mt-4">
              <a href="#rules-section" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[#0b0d07] bg-gradient-to-r from-[#d8ff62] to-[#f3ffb7] font-bold text-sm shadow-[0_14px_36px_rgba(216,255,98,0.16)] hover:translate-y-[-3px] transition-all active:translate-y-0 cursor-pointer">
                Open Protection Rules
              </a>
              <a href="#data-access" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] backdrop-blur-md font-bold text-sm hover:translate-y-[-3px] transition-all active:translate-y-0 cursor-pointer">
                Review Access Limits
              </a>
            </div>
          </div>

          {/* Hero terminal panel */}
          <aside className="w-full relative min-h-[460px] sm:min-h-[500px] rounded-3xl overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-4 sm:p-5 select-none touch-none">
            {/* Ambient inner glow colors */}
            <div className="absolute inset-0 bg-radial-gradient from-[#d8ff62]/[0.08] via-[#7cf2c9]/[0.03] to-transparent pointer-events-none" />
            
            <div className="h-full border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between gap-6 relative z-10 bg-[#07070a]/28 backdrop-blur-md">
              <div className="flex justify-between items-center gap-4 text-[#b5b0a6] text-xs">
                <span>System policy state</span>
                <span className="px-2.5 py-1 rounded-full border border-[#d8ff62]/22 bg-[#d8ff62]/8 text-[#eaffaa] font-bold uppercase tracking-wider">
                  Deletion Blocked
                </span>
              </div>

              {/* Logs simulation */}
              <div className="flex flex-col gap-3.5 text-left flex-1 py-4 justify-center">
                <div className="grid grid-cols-[100px_1fr] gap-4 items-start p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[#d8ff62] font-bold text-xs uppercase tracking-wider font-mono">Comments</span>
                  <div className="text-sm text-white">
                    Deletion disabled by default for system actions and unauthorized actors.
                    <span className="block text-[#b5b0a6] text-[11px] mt-1">Automatic removal must remain off unless lawful, user-approved, and fully audited.</span>
                  </div>
                </div>

                <div className="grid grid-cols-[100px_1fr] gap-4 items-start p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[#d8ff62] font-bold text-xs uppercase tracking-wider font-mono">Posts</span>
                  <div className="text-sm text-white">
                    User-created posts are protected from forced deletion and silent purge routines.
                    <span className="block text-[#b5b0a6] text-[11px] mt-1">Retention requires visible controls, recovery support, and owner confirmation flows.</span>
                  </div>
                </div>

                <div className="grid grid-cols-[100px_1fr] gap-4 items-start p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[#d8ff62] font-bold text-xs uppercase tracking-wider font-mono">Media</span>
                  <div className="text-sm text-white">
                    Pictures and videos must not be automatically erased or overwritten.
                    <span className="block text-[#b5b0a6] text-[11px] mt-1">Safeguards should prevent destructive cleanup behavior against user media libraries.</span>
                  </div>
                </div>
              </div>

              {/* Badges/Tags in Terminal footer */}
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="px-2.5 py-1 text-[11px] rounded-full bg-white/[0.04] border border-white/[0.08] text-[#b5b0a6]">audit trail required</span>
                <span className="px-2.5 py-1 text-[11px] rounded-full bg-white/[0.04] border border-white/[0.08] text-[#b5b0a6]">owner consent priority</span>
                <span className="px-2.5 py-1 text-[11px] rounded-full bg-white/[0.04] border border-white/[0.08] text-[#b5b0a6]">destructive actions disabled</span>
              </div>
            </div>
          </aside>
        </section>

        {/* POLICY STATEMENT SECTION */}
        <section id="rules-section" className="py-12 border-t border-white/[0.05]">
          <div className="grid md:grid-cols-[0.8fr_1.2fr] gap-8 items-end mb-10 text-left">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-none font-display">
              Protection policy
            </h2>
            <p className="text-[#b5b0a6] text-sm sm:text-base leading-relaxed">
              The following policy statements translate your request into a clear, non-destructive
              content handling model. This is a front-end policy page only, intended to communicate
              the rules and expectations for a platform that preserves user-generated content.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 text-left">
            {/* Rule 1 */}
            <article className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.03] border border-white/[0.12] overflow-hidden min-h-[220px] flex flex-col justify-between">
              <div>
                <span className="text-[#d8ff62] font-semibold text-xs tracking-wider uppercase mb-3 block font-mono">Rule 01</span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-display">Block automatic deletion of comments</h3>
                <p className="text-[#b5b0a6] text-sm leading-relaxed mb-4">
                  Any automated process that removes user comments should remain disabled by default.
                  If moderation is necessary, the system should prefer flagging, reviewing, or hiding
                  with traceability rather than permanently deleting content without due process.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-dashed border-white/14 bg-white/[0.02] text-[#f1eecf] text-xs font-medium">
                Required stance: no silent auto-delete routine for user comments.
              </div>
            </article>

            {/* Rule 2 */}
            <article className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.03] border border-white/[0.12] overflow-hidden min-h-[220px] flex flex-col justify-between">
              <div>
                <span className="text-[#d8ff62] font-semibold text-xs tracking-wider uppercase mb-3 block font-mono">Rule 02</span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-display">Prevent unauthorized deletion by anyone</h3>
                <p className="text-[#b5b0a6] text-sm leading-relaxed mb-4">
                  No user, staff member, process, or service should be able to remove another user's
                  comments or posts without explicit authority, logged reason codes, and appropriate legal
                  or policy justification.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-dashed border-white/14 bg-white/[0.02] text-[#f1eecf] text-xs font-medium">
                Required stance: deletion privileges must be tightly scoped and recorded.
              </div>
            </article>

            {/* Rule 3 */}
            <article className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.03] border border-white/[0.12] overflow-hidden min-h-[220px] flex flex-col justify-between">
              <div>
                <span className="text-[#d8ff62] font-semibold text-xs tracking-wider uppercase mb-3 block font-mono">Rule 03</span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-display">Protect posts, pictures, and videos</h3>
                <p className="text-[#b5b0a6] text-sm leading-relaxed mb-4">
                  User posts and media files should be preserved against automatic cleanup, destructive
                  synchronization, retention misconfiguration, or background purge systems that erase
                  content without owner approval and recovery options.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-dashed border-white/14 bg-white/[0.02] text-[#f1eecf] text-xs font-medium">
                Required stance: user media must not be auto-erased or destructively replaced.
              </div>
            </article>

            {/* Rule 4 */}
            <article id="data-access" className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.03] border border-white/[0.12] overflow-hidden min-h-[220px] flex flex-col justify-between">
              <div>
                <span className="text-[#d8ff62] font-semibold text-xs tracking-wider uppercase mb-3 block font-mono">Rule 04</span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-display">Deny data fetching that corrupts files</h3>
                <p className="text-[#b5b0a6] text-sm leading-relaxed mb-4">
                  If a retrieval, export, indexing, scan, or integration could expose, alter, corrupt,
                  or otherwise harm user content, the request should be blocked or sandboxed until it is
                  proven safe and non-destructive.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-dashed border-white/14 bg-white/[0.02] text-[#f1eecf] text-xs font-medium">
                Required stance: protection-first access control beats convenience-based access.
              </div>
            </article>
          </div>
        </section>

        {/* ENFORCEMENT PROTOCOL SECTION */}
        <section id="safeguards-section" className="py-12 border-t border-white/[0.05]">
          <div className="grid md:grid-cols-[0.8fr_1.2fr] gap-8 items-end mb-10 text-left">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-none font-display">
              Enforcement logic
            </h2>
            <p className="text-[#b5b0a6] text-sm sm:text-base leading-relaxed">
              A practical implementation would require transparent controls, recovery paths, and strict
              permission boundaries. The list below outlines the expected operating behavior at a
              high level without exposing backend internals.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 text-left items-stretch">
            {/* Logic items lists container */}
            <div className="p-6 sm:p-8 rounded-[28px] border border-white/[0.12] bg-gradient-to-b from-white/[0.06] to-white/[0.025] flex flex-col gap-4">
              <span className="text-[#d8ff62] font-semibold text-xs uppercase tracking-wider font-mono">Operational safeguards</span>
              
              <div className="flex flex-col gap-3.5">
                {[
                  {
                    num: '1',
                    title: 'Default to non-destructive actions',
                    text: 'Use hide, quarantine, or review states instead of irreversible deletion whenever possible.'
                  },
                  {
                    num: '2',
                    title: 'Require explicit owner consent',
                    text: 'Any permanent removal of user comments, posts, pictures, or videos should require a clear confirmation path from the content owner or lawful authority.'
                  },
                  {
                    num: '3',
                    title: 'Keep audit trails',
                    text: 'Every access, moderation event, or attempted deletion should be logged with actor, reason, time, and scope.'
                  },
                  {
                    num: '4',
                    title: 'Block risky fetch operations',
                    text: 'If a data request could damage, expose, or destabilize user files, fail safely and deny the action until validated.'
                  },
                  {
                    num: '5',
                    title: 'Provide recovery and appeal channels',
                    text: 'Where policy requires moderation, preserve restorability and notify the user with a path for review.'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[auto_1fr] gap-4 items-start p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#d8ff62]/16 to-[#7cf2c9]/12 border border-[#d8ff62]/18 text-[#d8ff62] font-bold text-sm font-mono shrink-0">
                      {item.num}
                    </div>
                    <div>
                      <strong className="block text-white text-[15px] font-semibold mb-1">{item.title}</strong>
                      <span className="text-[#b5b0a6] text-sm leading-normal">{item.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shield graphic on right */}
            <aside className="p-6 sm:p-8 rounded-[28px] border border-white/[0.12] bg-gradient-to-b from-white/[0.06] to-white/[0.025] flex flex-col justify-between gap-6 relative">
              <div className="w-full max-w-[280px] mx-auto p-4 rounded-[44px] bg-white/[0.04] border border-white/10 flex items-center justify-center p-6 bg-[#000]/10 shrink-0">
                <svg className="w-full aspect-square" viewBox="0 0 300 300" role="img" aria-label="Protective shield illustration">
                  <path d="M150 58 L228 88 V144 C228 196 193 232 150 250 C107 232 72 196 72 144 V88 Z"
                        fill="url(#shieldGrad)" opacity="0.18" stroke="rgba(216,255,98,0.45)" strokeWidth="2"/>
                  <path d="M150 82 L207 104 V145 C207 184 182 213 150 229 C118 213 93 184 93 145 V104 Z"
                        fill="rgba(10,10,13,0.72)" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
                  <path d="M129 151 L145 167 L176 132" fill="none" stroke="url(#shieldGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="98" cy="86" r="8" fill="#d8ff62" opacity="0.8"/>
                  <circle cx="214" cy="208" r="10" fill="#7cf2c9" opacity="0.7"/>
                  <defs>
                    <linearGradient id="shieldGrad" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#d8ff62" stopOpacity="0.95"/>
                      <stop offset="100%" stopColor="#7cf2c9" stopOpacity="0.95"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-b from-[#ff7d7d]/10 to-[#ff7d7d]/4 border border-[#ff7d7d]/20">
                <strong className="block text-[#ffd3d3] font-bold text-sm uppercase mb-1.5 font-mono">Important Note</strong>
                <p className="text-[#b5b0a6] text-sm leading-relaxed">
                  This page provides UI wording and policy presentation only. Real enforcement must be
                  implemented on the server, storage, permissions, moderation, and audit layers.
                </p>
              </div>

              <p className="text-[#b5b0a6] text-xs leading-relaxed text-center sm:text-left">
                Front-end code alone cannot truly prevent deletion or data access if the backend still
                allows it. The platform architecture must enforce these rules.
              </p>
            </aside>
          </div>
        </section>

        {/* FOOTER ACCENTS */}
        <footer className="mt-10 mb-16">
          <div className="p-6 sm:p-8 border border-white/[0.08] rounded-3xl bg-white/[0.04] flex flex-col md:flex-row justify-between items-center gap-6 text-left">
            <p className="text-[#b5b0a6] text-sm leading-relaxed max-w-[70ch]">
              Summary: block automatic deletion of user comments, posts, pictures, and videos; restrict
              unauthorized removal; and deny user data fetching whenever it may damage files or content integrity.
            </p>
            <button 
              onClick={() => {
                const element = document.getElementById('policy-view-root');
                if (element) element.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3.5 rounded-xl text-[#0b0d07] bg-gradient-to-r from-[#d8ff62] to-[#7cf2c9] hover:translate-y-[-2px] transition-all cursor-pointer font-bold font-mono text-xs shadow-[0_10px_30px_rgba(216,255,98,0.2)]"
            >
              Back to top
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
