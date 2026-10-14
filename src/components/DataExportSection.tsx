import React, { useState, useEffect } from 'react';
import { 
  Download, FileJson, Check, Copy, Eye, EyeOff, Loader2, Sparkles, 
  ShieldCheck, MessageSquare, Image, User, PhoneCall, CheckCircle2,
  FileCode2, AlertCircle, RefreshCw, Layers, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DataExportService, UserExportArchive, ExportFilterOptions } from '../services/dataExportService';

interface DataExportSectionProps {
  currentUserId: string;
  currentUserName: string;
  currentUserEmail: string;
  profileData: any;
}

export default function DataExportSection({
  currentUserId,
  currentUserName,
  currentUserEmail,
  profileData,
}: DataExportSectionProps) {
  const [filterOptions, setFilterOptions] = useState<ExportFilterOptions>({
    includeProfile: true,
    includePosts: true,
    includeChats: true,
    includeMediaAndActivity: true,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<{ filename: string; size: string } | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [previewArchive, setPreviewArchive] = useState<UserExportArchive | null>(null);
  const [stats, setStats] = useState<{
    postsCount: number;
    commentsCount: number;
    chatsCount: number;
    messagesCount: number;
    callLogsCount: number;
    reelsCount: number;
  }>({
    postsCount: 0,
    commentsCount: 0,
    chatsCount: 0,
    messagesCount: 0,
    callLogsCount: 0,
    reelsCount: 0,
  });

  // Calculate live stats on mount and when filter changes
  useEffect(() => {
    const loadStats = async () => {
      try {
        const archive = await DataExportService.buildUserArchive(
          currentUserId,
          currentUserName,
          currentUserEmail,
          profileData,
          filterOptions
        );
        setStats({
          postsCount: archive.postsActivity.authoredPostsCount,
          commentsCount: archive.postsActivity.userCommentsCount,
          chatsCount: archive.chatsActivity.totalConversations,
          messagesCount: archive.chatsActivity.totalMessagesExchanged,
          callLogsCount: archive.additionalActivity.callLogsCount,
          reelsCount: archive.additionalActivity.reelsCount,
        });
        setPreviewArchive(archive);
      } catch (err) {
        console.error('Failed to load export preview stats:', err);
      }
    };
    loadStats();
  }, [currentUserId, currentUserName, currentUserEmail, filterOptions]);

  const handleExportDownload = async () => {
    setIsGenerating(true);
    setDownloadSuccess(null);
    try {
      const archive = await DataExportService.buildUserArchive(
        currentUserId,
        currentUserName,
        currentUserEmail,
        profileData,
        filterOptions
      );
      setPreviewArchive(archive);

      const result = DataExportService.downloadJsonFile(archive);
      const sizeStr = DataExportService.formatBytes(result.sizeBytes);
      setDownloadSuccess({
        filename: result.filename,
        size: sizeStr,
      });
    } catch (err: any) {
      console.error('Data export failed:', err);
      alert('Failed to generate export file: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      let archive = previewArchive;
      if (!archive) {
        archive = await DataExportService.buildUserArchive(
          currentUserId,
          currentUserName,
          currentUserEmail,
          profileData,
          filterOptions
        );
      }
      const jsonString = JSON.stringify(archive, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const handleTogglePreview = async () => {
    if (!showJsonPreview && !previewArchive) {
      setIsGenerating(true);
      try {
        const archive = await DataExportService.buildUserArchive(
          currentUserId,
          currentUserName,
          currentUserEmail,
          profileData,
          filterOptions
        );
        setPreviewArchive(archive);
      } catch (err) {
        console.error('Failed to load JSON preview:', err);
      } finally {
        setIsGenerating(false);
      }
    }
    setShowJsonPreview(!showJsonPreview);
  };

  return (
    <div className="space-y-5 animate-fade-in text-left">
      {/* Header Title */}
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-extrabold text-[15px] text-gray-800 flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-600" />
          <span>EXPORT PERSONAL ACTIVITY DATA</span>
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full flex items-center gap-1 font-mono">
          <FileJson className="w-3 h-3" /> JSON Format
        </span>
      </div>

      {/* Main Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden border border-blue-900/60">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-sm text-white tracking-wide flex items-center gap-2">
              <span>Personal Activity Archive</span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono px-2 py-0.2 rounded-full">
                GDPR Compliant
              </span>
            </h4>
            <p className="text-[11px] text-blue-200/90 font-medium">
              Export your posts, chat history, messages, and profile records in standard JSON
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Download a complete, offline-accessible snapshot of your account data including profile attributes, authored posts, comments, conversation messages, call logs, and application preferences.
        </p>

        {/* Live Data Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 flex flex-col">
            <span className="text-[9px] font-bold text-blue-200 uppercase flex items-center gap-1">
              <User className="w-3 h-3 text-blue-300" /> Profile Info
            </span>
            <span className="text-base font-black font-mono mt-0.5 text-white">
              {filterOptions.includeProfile ? '1 Account' : 'Excluded'}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 flex flex-col">
            <span className="text-[9px] font-bold text-blue-200 uppercase flex items-center gap-1">
              <Image className="w-3 h-3 text-amber-300" /> Posts &amp; Comments
            </span>
            <span className="text-base font-black font-mono mt-0.5 text-white">
              {filterOptions.includePosts ? `${stats.postsCount} posts (${stats.commentsCount} comments)` : 'Excluded'}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 flex flex-col">
            <span className="text-[9px] font-bold text-blue-200 uppercase flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-emerald-300" /> Chats &amp; Messages
            </span>
            <span className="text-base font-black font-mono mt-0.5 text-white">
              {filterOptions.includeChats ? `${stats.chatsCount} chats (${stats.messagesCount} msgs)` : 'Excluded'}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 flex flex-col">
            <span className="text-[9px] font-bold text-blue-200 uppercase flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-300" /> Activity Records
            </span>
            <span className="text-base font-black font-mono mt-0.5 text-white">
              {filterOptions.includeMediaAndActivity ? `${stats.callLogsCount} calls, ${stats.reelsCount} reels` : 'Excluded'}
            </span>
          </div>
        </div>

        {/* Primary Download Action */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleExportDownload}
            className="flex-1 py-3 px-4 rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/50 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Compiling JSON Archive...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Activity JSON File</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyToClipboard}
            className="py-3 px-4 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            {copiedToClipboard ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-blue-300" />
                <span>Copy JSON</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleTogglePreview}
            className="py-3 px-4 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            {showJsonPreview ? (
              <>
                <EyeOff className="w-4 h-4 text-slate-300" />
                <span>Hide Preview</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-blue-300" />
                <span>Inspect JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {downloadSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3 shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-extrabold">Data archive successfully exported!</p>
            <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
              Saved as: <span className="font-bold underline">{downloadSuccess.filename}</span> ({downloadSuccess.size})
            </p>
            <p className="text-[10px] text-emerald-600 mt-1">
              The JSON file contains your complete selected records and was downloaded directly to your device's Downloads folder.
            </p>
          </div>
        </motion.div>
      )}

      {/* Filter Selection Options */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Customize Export Contents</span>
          </h4>
          <button
            type="button"
            onClick={() =>
              setFilterOptions({
                includeProfile: true,
                includePosts: true,
                includeChats: true,
                includeMediaAndActivity: true,
              })
            }
            className="text-[10px] text-blue-600 font-bold hover:underline"
          >
            Select All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Profile Option */}
          <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterOptions.includeProfile}
              onChange={(e) => setFilterOptions({ ...filterOptions, includeProfile: e.target.checked })}
              className="accent-blue-600 w-4 h-4 mt-0.5 cursor-pointer rounded"
            />
            <div>
              <p className="text-xs font-black text-gray-800">User Profile &amp; Preferences</p>
              <p className="text-[10.5px] text-gray-500 leading-tight mt-0.5">
                Account ID, full name, username, bio, avatar URL, phone, city, age, wallet balance, and theme settings.
              </p>
            </div>
          </label>

          {/* Posts & Comments Option */}
          <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterOptions.includePosts}
              onChange={(e) => setFilterOptions({ ...filterOptions, includePosts: e.target.checked })}
              className="accent-blue-600 w-4 h-4 mt-0.5 cursor-pointer rounded"
            />
            <div>
              <p className="text-xs font-black text-gray-800">Authored Posts &amp; Comments</p>
              <p className="text-[10.5px] text-gray-500 leading-tight mt-0.5">
                All feed posts published by you, captions, timestamps, likes received, comments made, and saved bookmarks.
              </p>
            </div>
          </label>

          {/* Chats & Messages Option */}
          <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterOptions.includeChats}
              onChange={(e) => setFilterOptions({ ...filterOptions, includeChats: e.target.checked })}
              className="accent-blue-600 w-4 h-4 mt-0.5 cursor-pointer rounded"
            />
            <div>
              <p className="text-xs font-black text-gray-800">Conversations &amp; Chat History</p>
              <p className="text-[10.5px] text-gray-500 leading-tight mt-0.5">
                Direct chats, group threads, full message logs with timestamps, sender tags, media attachments, and voice notes.
              </p>
            </div>
          </label>

          {/* Additional Activity Option */}
          <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterOptions.includeMediaAndActivity}
              onChange={(e) => setFilterOptions({ ...filterOptions, includeMediaAndActivity: e.target.checked })}
              className="accent-blue-600 w-4 h-4 mt-0.5 cursor-pointer rounded"
            />
            <div>
              <p className="text-xs font-black text-gray-800">Reels, Calls &amp; Extra Activity</p>
              <p className="text-[10.5px] text-gray-500 leading-tight mt-0.5">
                Short video reels, stories, call duration logs, listed storefront products, and active ad campaigns.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Interactive JSON Inspector (Expandable) */}
      <AnimatePresence>
        {showJsonPreview && previewArchive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-blue-600" />
                <span>Raw JSON Archive Preview</span>
              </span>
              <button
                type="button"
                onClick={handleCopyToClipboard}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedToClipboard ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 font-mono text-[11px] max-h-80 overflow-y-auto leading-relaxed shadow-inner">
              <pre className="whitespace-pre-wrap word-break">
                {JSON.stringify(previewArchive, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security & Privacy Commitment */}
      <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-left text-[11px] text-blue-900 leading-relaxed">
          <span className="font-extrabold block text-blue-950">Data Security &amp; Ownership Guarantee</span>
          Your exported archive is compiled on-demand exclusively for your account. IMChat does not sell or share personal activity records. All JSON data downloaded is stored locally on your device.
        </div>
      </div>
    </div>
  );
}
