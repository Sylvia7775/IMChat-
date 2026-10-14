import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, Check, Shield, Info, ChevronDown, ChevronUp, HelpCircle, Users, Bell, Sparkles, Smartphone } from 'lucide-react';
import LanguagesIcon from './components/LanguagesIcon';
import { LANGUAGES, useLanguage, detectBrowserLanguage } from './lib/i18n';

const FAQS = [
  {
    category: 'general',
    question: "¿Cómo creo un nuevo evento? / How do I create a new event?",
    answer: "Puedes crear un evento tocando el icono '+' en la esquina superior derecha del Calendario de Eventos, o haciendo clic en el botón 'Añadir Evento'. / You can create an event by tapping the '+' icon in the Event Calendar top right corner, or by clicking the 'Add Event' button!"
  },
  {
    category: 'account',
    question: "¿Puedo subir una foto de portada para mi evento? / Can I upload an event cover?",
    answer: "¡Sí! Al crear o editar un evento, verás una sección de 'Imagen de portada' donde puedes subir una foto hermosa. / Yes! When creating or editing an event, you'll see a 'Cover Image' section where you can upload a photo."
  },
  {
    category: 'general',
    question: "¿Qué categorías de eventos hay? / What event categories are available?",
    answer: "Admitimos las categorías de Cumpleaños, Entretenimiento, Catering, Reunión, Música, Fiesta de casa, Tour, Deportes, Evento escolar y Seminario web. / We support Birthday, Entertainment, Catering, Meeting, Music, House Party, Tour, Sports, School Event, and Webinar categories."
  },
  {
    category: 'safety',
    question: "¿Hay límite de eventos creados? / Is there a limit on events?",
    answer: "Actualmente, puedes crear hasta 100 eventos en tu calendario personal. Los eventos se guardan localmente en tu dispositivo. / Currently, you can create up to 100 events in your personal calendar. Events are stored locally on your device."
  },
  {
    category: 'privacy',
    question: "¿Cómo comparto un evento con amigos? / How can I share an event?",
    answer: "Cada evento tiene un icono de 'Compartir'. Al tocarlo se abrirá el menú nativo para compartir de tu dispositivo o copiará un enlace al portapapeles. / Each event has a 'Share' icon. Tapping it will open your device's native share menu or copy a link to your clipboard."
  }
];

export default function LanguagesPage({ onBack }: { onBack: () => void }) {
  const { language, setLanguage, resetToDeviceLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'languages' | 'faq'>('languages');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(null);
  const [activeFAQCategory, setActiveFAQCategory] = useState<'all' | 'general' | 'account' | 'privacy'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const detectedInfo = detectBrowserLanguage();

  const handleSelectLanguage = async (code: string, name: string, nativeName: string) => {
    await setLanguage(code);
    setToastMessage(`${t('lang_changed_toast', 'Language changed to')} ${name} (${nativeName})`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleResetDeviceLanguage = async () => {
    await resetToDeviceLanguage();
    setToastMessage(`${t('lang_changed_toast', 'Language changed to')} ${detectedInfo.language.name} (${detectedInfo.language.nativeName})`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const filteredLanguages = LANGUAGES.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaqs = FAQS.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeFAQCategory === 'all' || faq.category === activeFAQCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-white text-gray-900 relative"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-gray-700/50 backdrop-blur-md"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3px]" />
            </div>
            <span className="text-sm font-semibold tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-white p-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 z-20">
        <button 
          onClick={onBack} 
          className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95 text-gray-800"
          aria-label={t('action_back', 'Back')}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-bold text-lg tracking-tight">
            {activeTab === 'languages' ? t('lang_title', 'Idiomas / Languages') : t('tab_faq', 'Ayuda / Help Center')}
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            {activeTab === 'languages' 
              ? `${LANGUAGES.length} ${t('lang_subtitle', 'Languages Available')}` 
              : 'Preguntas Frecuentes & FAQ'}
          </p>
        </div>
        <div className="flex-1"></div>
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-brand-blue overflow-hidden shadow-inner">
          {activeTab === 'languages' ? (
            <LanguagesIcon className="w-7 h-7" />
          ) : (
            <HelpCircle className="w-6 h-6 text-brand-blue" />
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white sticky top-[69px] z-10 shadow-sm">
        <button
          onClick={() => {
            setActiveTab('languages');
            setSearchQuery('');
          }}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider text-center border-b-[3px] transition-all duration-200 ${
            activeTab === 'languages'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          {t('tab_languages', 'Idiomas / Languages')}
        </button>
        <button
          onClick={() => {
            setActiveTab('faq');
            setSearchQuery('');
          }}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider text-center border-b-[3px] transition-all duration-200 ${
            activeTab === 'faq'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          {t('tab_faq', 'Preguntas Frecuentes / FAQ')}
        </button>
      </div>

      {/* Search Input & Auto-detect bar */}
      <div className="p-4 bg-gray-50/50 border-b border-gray-100 space-y-3">
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-blue transition-colors" />
          <input 
            type="text" 
            placeholder={activeTab === 'languages' ? t('search_languages_placeholder', 'Search 500+ languages...') : t('search_faq_placeholder', 'Search FAQs...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-brand-blue focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>

        {activeTab === 'languages' && !searchQuery && (
          <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/80 p-3 rounded-2xl border border-blue-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-900">
                  {t('lang_auto_detected', 'Detected Language')}: <span className="text-brand-blue font-bold">{detectedInfo.language.name}</span>
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  {t('lang_device_detected_tip', 'Automatically detected from your device locale')}
                </span>
              </div>
            </div>

            {language !== detectedInfo.code && (
              <button
                onClick={handleResetDeviceLanguage}
                className="px-3 py-1.5 bg-brand-blue text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-600 active:scale-95 transition-all flex-shrink-0 flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{t('use_device_language', 'Use Device')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'languages' ? (
          <div className="p-4 space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredLanguages.length > 0 ? (
                filteredLanguages.map((lang, index) => {
                  const isSelected = language.toLowerCase() === lang.code.toLowerCase();
                  return (
                    <motion.button
                      key={lang.code + '-' + index}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: Math.min(index * 0.005, 0.15) }}
                      onClick={() => handleSelectLanguage(lang.code, lang.name, lang.nativeName)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.99] ${
                        isSelected 
                          ? 'bg-blue-50/80 border-brand-blue shadow-sm ring-1 ring-brand-blue/20' 
                          : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs tracking-wider transition-colors ${
                          isSelected 
                            ? 'bg-brand-blue text-white shadow-md shadow-blue-200' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {lang.code.toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-[15px] ${isSelected ? 'text-brand-blue' : 'text-gray-900'}`}>
                              {lang.name}
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-brand-blue text-[10px] font-extrabold uppercase tracking-wider">
                                {t('lang_set_as_app', 'Active')}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{lang.nativeName}</span>
                        </div>
                      </div>

                      {isSelected ? (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 bg-brand-blue rounded-full flex items-center justify-center text-white shadow-md shadow-blue-100 flex-shrink-0"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3px]" />
                        </motion.div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center text-transparent group-hover:border-gray-400"></div>
                      )}
                    </motion.button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                    <LanguagesIcon className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="font-bold text-sm text-gray-700">{t('lang_no_matches', 'No matches found')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('lang_try_different', 'Try searching for a different language')}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* FAQ Filter buttons */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'Todos / All', icon: HelpCircle },
                { id: 'general', label: 'Eventos', icon: Users },
                { id: 'privacy', label: 'Privacidad', icon: Shield },
                { id: 'account', label: 'Portada', icon: Bell }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveFAQCategory(cat.id as any);
                    setOpenFAQIndex(null);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                    activeFAQCategory === cat.id 
                      ? 'bg-brand-blue text-white shadow-md shadow-blue-100' 
                      : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, idx) => (
                    <motion.div 
                      key={idx} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      <button 
                        onClick={() => setOpenFAQIndex(openFAQIndex === idx ? null : idx)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left gap-3"
                      >
                        <span className="font-bold text-gray-800 text-[14px] leading-snug">{faq.question}</span>
                        {openFAQIndex === idx ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>
                      
                      <AnimatePresence>
                        {openFAQIndex === idx && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-5 pb-5 text-[13px] text-gray-500 leading-relaxed border-t border-gray-50 pt-3"
                          >
                            {faq.answer}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <p className="font-bold text-sm">No se encontraron preguntas / No FAQs found</p>
                    <p className="text-xs">Prueba con otra palabra clave / Try another search word</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Support section card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5 rounded-2xl border border-blue-100/30">
              <h4 className="font-bold text-brand-blue text-sm mb-1">¿Necesitas soporte técnico? / Need further help?</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Nuestro centro de ayuda está disponible para ayudarte las 24 horas. También puedes contactar al soporte del sistema desde tu menú de chat principal.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer message contextualized by tab */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <p className="text-[11px] text-gray-500 font-medium leading-tight">
          {activeTab === 'languages' 
            ? t('lang_notice', "Changing the language will update the UI and system messages. Some user content may still appear in its original language.")
            : "Este centro de documentación se actualiza dinámicamente según las normativas y novedades de la comunidad IMChat."}
        </p>
      </div>
    </motion.div>
  );
}
