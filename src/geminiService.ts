import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("Gemini API Key is missing or using placeholder. AI features will be disabled.");
      return null;
    }
    try {
      aiInstance = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.error("Failed to initialize GoogleGenAI:", e);
      return null;
    }
  }
  return aiInstance;
}

export const geminiService = {
  async generateText(prompt: string): Promise<string> {
    if (!prompt || prompt.trim().length === 0) return '';
    const ai = getAI();
    if (!ai) return '';

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text?.trim() || '';
    } catch (error) {
      console.error("Gemini Generate Error:", error);
      return '';
    }
  },

  async chatWithAssistant(history: { sender: 'user' | 'assistant'; text: string }[], userMessage: string): Promise<string> {
    if (!userMessage || userMessage.trim().length === 0) return '';
    const ai = getAI();
    if (!ai) {
      // Friendly offline/fallback assistant response
      const lower = userMessage.toLowerCase();
      if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        return "Hello! 👋 I'm your IMChat AI Assistant. I can help you draft messages, create post captions, answer questions, or chat anytime. How can I help you today?";
      }
      if (lower.includes('help')) {
        return "I can help you with:\n• ✍️ Drafting & polishing messages\n• 💡 Coming up with captions & hashtags for posts\n• 🌐 Translating text to any language\n• 💬 Answering quick questions";
      }
      if (lower.includes('caption') || lower.includes('post')) {
        return "Here's a great caption idea: 'Making every moment count ✨ What's bringing you joy today? #GoodVibes #IMChatCommunity'";
      }
      return `Thanks for asking! As your IMChat AI Assistant, I'm here to help you connect and create. Here's a tip: "${userMessage}" sounds great! Would you like me to rewrite it or provide smart suggestions?`;
    }

    try {
      const formattedHistory = history.slice(-6).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');
      const prompt = `You are IMChat AI Assistant, a friendly, ultra-helpful, modern AI companion built inside the IMChat social platform. You help users with chats, suggestions, questions, drafting creative messages, and social media tips. Keep replies warm, concise, and helpful with appropriate emojis.\n\nConversation so far:\n${formattedHistory}\nUser: ${userMessage}\nAssistant:`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text?.trim() || "I'm here to help! What would you like to explore next?";
    } catch (error) {
      console.error("Gemini Assistant Error:", error);
      return "Hello! I am your IMChat AI Assistant. How can I assist you with your messages or posts today?";
    }
  },

  async getSmartReplies(conversationContext: string): Promise<string[]> {
    const ai = getAI();
    if (!ai || !conversationContext) {
      return ["Sounds good! 👍", "Thanks for letting me know! 🙏", "Let's connect soon! 😊"];
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on this recent message in a chat: "${conversationContext.slice(-200)}", generate exactly 3 short, natural, friendly quick replies (each under 7 words). Return ONLY a JSON array of 3 strings like ["reply 1", "reply 2", "reply 3"]. Do not include markdown code fences if possible.`,
      });
      const raw = response.text?.trim().replace(/```json/g, '').replace(/```/g, '').trim() || '';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3);
      }
    } catch (e) {
      // Fallback
    }
    return ["Sounds great! 👍", "Got it, thanks! 🙌", "Talk to you soon! 😊"];
  },

  async rewriteMessage(text: string, style: 'friendly' | 'professional' | 'concise' | 'creative' = 'friendly'): Promise<string> {
    if (!text || text.trim().length === 0) return text;
    const ai = getAI();
    if (!ai) return text;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Rewrite this chat message in a ${style} tone. Keep it natural and engaging for social chat. Return ONLY the rewritten message.\n\nMessage: "${text}"`,
      });
      return response.text?.trim() || text;
    } catch (error) {
      return text;
    }
  },

  async translateText(text: string, targetLanguage: string = 'English'): Promise<string> {
    if (!text || text.trim().length === 0) return text;
    const ai = getAI();
    if (!ai) return text;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate the following text to ${targetLanguage}. Return ONLY the translated text. Do not add explanations or quotes.\n\nText: ${text}`,
      });
      return response.text?.trim() || text;
    } catch (error) {
      console.error("Gemini Translation Error:", error);
      return text;
    }
  }
};
