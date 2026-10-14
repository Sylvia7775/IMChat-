import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import multer from "multer";
import admin from "firebase-admin";
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from "@google/genai";

// Ensure globalThis.__dirname does not leak as relative '.' into ESM plugins
if (typeof (globalThis as any).__dirname === 'string' && !path.isAbsolute((globalThis as any).__dirname)) {
  delete (globalThis as any).__dirname;
}
if (typeof (globalThis as any).__filename === 'string' && !path.isAbsolute((globalThis as any).__filename)) {
  delete (globalThis as any).__filename;
}

let aiClientInstance: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '';
    aiClientInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClientInstance;
}

const _filename = typeof import.meta !== 'undefined' && import.meta.url
  ? fileURLToPath(import.meta.url)
  : __filename;
const _dirname = typeof import.meta !== 'undefined' && import.meta.url
  ? path.dirname(_filename)
  : __dirname;

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const originalName = file.originalname || "";
    let ext = path.extname(originalName);
    if (!ext && file.mimetype) {
      const parts = file.mimetype.split("/");
      if (parts.length === 2) {
        ext = "." + parts[1].split(";")[0]; // handle cases like video/mp4;codec=...
      }
    }
    cb(null, (file.fieldname || 'file') + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Load Firebase Config
let firebaseConfigPath = path.join(_dirname, "firebase-applet-config.json");
if (!fs.existsSync(firebaseConfigPath)) {
  firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
}
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Admin (Note: Uses Application Default Credentials by default)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // Serve public folder for uploads
  app.use("/uploads", express.static(uploadsDir));

  // IP Banning Middleware
  app.use(async (req, res, next) => {
    // Only apply IP banning to API routes to ensure static asset/main page loads never hang
    if (!req.path.startsWith('/api')) {
      return next();
    }

    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
    
    try {
      const ipDocId = clientIp.replace(/\./g, '_');
      
      // Limit Firestore lookup to 1200ms to prevent hanging API requests if Firestore has latency
      const getDocWithTimeout = Promise.race([
        getDoc(doc(db, "bannedIps", ipDocId)),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 1200)
        )
      ]);

      const banDoc = await getDocWithTimeout;
      
      if (banDoc && banDoc.exists()) {
        return res.status(403).json({ error: "Access Denied: Your IP has been banned." });
      }
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      if (errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('resource-exhausted') || errorMessage.toLowerCase().includes('quota limit exceeded') || errorMessage.toLowerCase().includes('timeout')) {
        console.warn(`[Server IP Auth Check] Firestore Quota, Offline or Timeout. Skipping active checks.`);
      } else {
        console.warn("[Server IP Auth Check] Offline or unable to contact Firestore backend:", errorMessage);
      }
    }
    next();
  });

  // API Route: Get Client IP
  app.get("/api/ip", (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
    res.json({ ip: clientIp });
  });

  // API Route: Instant Media Upload
  app.post("/api/upload", (req, res) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        console.error("Multer upload error:", err);
        return res.status(400).json({ error: err.message || "File upload failed" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      return res.json({ 
        success: true, 
        url: fileUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    });
  });

  // API Route: Proxy fetch an external URL to bypass CORS
  app.get("/api/fetch-url-blob", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("Missing url");
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) return res.status(response.status).send("Failed to fetch");
      const buffer = await response.arrayBuffer();
      res.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
      res.send(Buffer.from(buffer));
    } catch (e) {
      res.status(500).send("Error fetching URL");
    }
  });

  // ==========================================
  // PayPal Payment Processing API (REST API v2)
  // ==========================================
  const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'AaCTLbvNfi673I0PkreXuEuoauzuj9bzYTckhZTaT6AoUR1LgPHsR8QghOxqIsn_plBK0hJ2_bpfazOP';
  const defaultSecret = 'ENObMa0BKJ1SxSM_jciBTlDme09IhI1d-qdviEd0FirifXd11cDRbQYuNAQXNLgTU22HA6ak14opBNgx';
  const envSecret = process.env.PAYPAL_CLIENT_SECRET;
  const PAYPAL_CLIENT_SECRET = (envSecret && envSecret !== PAYPAL_CLIENT_ID && !envSecret.startsWith('AaCTL'))
    ? envSecret
    : defaultSecret;
  const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'live').toLowerCase();
  const PAYPAL_BASE_URL = PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';

  let paypalTokenCache: { token: string; expiresAt: number } | null = null;

  async function getPayPalAccessToken(): Promise<string> {
    const now = Date.now();
    if (paypalTokenCache && paypalTokenCache.expiresAt > now + 60000) {
      return paypalTokenCache.token;
    }

    const basicAuth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[PayPal Auth Error]', response.status, errText);
      throw new Error(`Failed to authenticate with PayPal: ${response.statusText}`);
    }

    const data = await response.json();
    const expiresInMs = (data.expires_in || 3600) * 1000;
    paypalTokenCache = {
      token: data.access_token,
      expiresAt: now + expiresInMs
    };
    return data.access_token;
  }

  // 1. Get PayPal Public Config
  app.get("/api/paypal/config", (req, res) => {
    res.json({
      clientId: PAYPAL_CLIENT_ID,
      currency: 'USD',
      appName: 'IMChat',
      mode: PAYPAL_MODE,
      configured: !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET)
    });
  });

  // 2. Create PayPal Order
  app.post("/api/paypal/create-order", async (req, res) => {
    try {
      const { 
        amount, 
        currency = 'USD', 
        description = 'IMChat Purchase', 
        itemType = 'marketplace_item', 
        itemId, 
        userId, 
        userEmail,
        metadata 
      } = req.body;

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount." });
      }

      const token = await getPayPalAccessToken();
      const formattedAmount = numAmount.toFixed(2);
      const referenceId = itemId ? `imchat_${itemId}_${Date.now()}` : `imchat_order_${Date.now()}`;

      const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: referenceId,
            description: (description || 'IMChat Payment').slice(0, 127),
            custom_id: JSON.stringify({ 
              itemType, 
              itemId: itemId || '', 
              userId: userId || '',
              ...(metadata || {}) 
            }).slice(0, 127),
            amount: {
              currency_code: currency.toUpperCase(),
              value: formattedAmount
            }
          }
        ],
        application_context: {
          brand_name: 'IMChat',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING'
        }
      };

      const orderRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        console.error('[PayPal Create Order Error]', orderRes.status, orderData);
        return res.status(orderRes.status).json({ 
          error: orderData.message || orderData.error_description || "Failed to create PayPal order", 
          details: orderData 
        });
      }

      const approveLink = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

      res.status(201).json({
        success: true,
        orderId: orderData.id,
        status: orderData.status,
        approveUrl: approveLink,
        currency,
        amount: formattedAmount
      });
    } catch (err: any) {
      console.error('[PayPal Create Order Exception]', err);
      res.status(500).json({ error: err.message || "Internal server error creating PayPal order" });
    }
  });

  // 3. Capture PayPal Order
  app.post("/api/paypal/capture-order", async (req, res) => {
    try {
      const { orderId, itemType, itemId, userId, userEmail, metadata } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
      }

      const token = await getPayPalAccessToken();
      const captureRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const captureData = await captureRes.json();
      if (!captureRes.ok) {
        console.error('[PayPal Capture Error]', captureRes.status, captureData);
        return res.status(captureRes.status).json({ 
          error: captureData.message || captureData.details?.[0]?.description || "Failed to capture PayPal payment",
          details: captureData 
        });
      }

      const purchaseUnit = captureData.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];
      const captureId = capture?.id || captureData.id;
      const paidAmount = capture?.amount?.value || purchaseUnit?.amount?.value || '0.00';
      const currency = capture?.amount?.currency_code || 'USD';
      const payer = captureData.payer || {};
      const numAmount = parseFloat(paidAmount);

      const transactionRecord = {
        orderId,
        captureId,
        status: captureData.status || 'COMPLETED',
        amount: numAmount,
        currency,
        payerEmail: payer.email_address || userEmail || '',
        payerName: `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim(),
        itemType: itemType || 'marketplace_item',
        itemId: itemId || '',
        userId: userId || '',
        metadata: metadata || {},
        createdAt: new Date().toISOString()
      };

      // Persist transaction to Firestore
      try {
        await addDoc(collection(db, "paypal_transactions"), {
          ...transactionRecord,
          createdAtServer: serverTimestamp()
        });
      } catch (firestoreErr) {
        console.warn("[PayPal] Firestore transaction logging warning:", firestoreErr);
      }

      // If user performed a wallet topup, credit their balance in Firestore
      if (itemType === 'wallet_topup' && userId) {
        try {
          const userDocRef = doc(db, "users", userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const currentBal = Number(userDoc.data().walletBalance || 0);
            await setDoc(userDocRef, { walletBalance: currentBal + numAmount }, { merge: true });
          }
        } catch (walletErr) {
          console.warn("[PayPal] Failed to auto-credit wallet in Firestore:", walletErr);
        }
      }

      res.json({
        success: true,
        status: captureData.status,
        orderId,
        captureId,
        paidAmount: numAmount,
        currency,
        payer: {
          email: payer.email_address || userEmail,
          name: `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim()
        },
        transaction: transactionRecord
      });
    } catch (err: any) {
      console.error('[PayPal Capture Exception]', err);
      res.status(500).json({ error: err.message || "Internal server error capturing PayPal payment" });
    }
  });

  // 4. Get PayPal Order Status
  app.get("/api/paypal/order/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      const token = await getPayPalAccessToken();
      const orderRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        return res.status(orderRes.status).json({ error: "Order lookup failed", details: orderData });
      }
      res.json(orderData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Query Recent PayPal Transactions for a user
  app.get("/api/paypal/transactions", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const q = userId 
        ? query(collection(db, "paypal_transactions"), where("userId", "==", userId))
        : query(collection(db, "paypal_transactions"));
      
      const snapshot = await getDocs(q);
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ success: true, transactions: txs });
    } catch (err: any) {
      console.warn("[PayPal Transactions Query]", err.message);
      res.json({ success: true, transactions: [] });
    }
  });

  // API Route: Admin Update User Password
  app.post("/api/admin/update-password", async (req, res) => {
    const { idToken, targetUid, newPassword } = req.body;

    if (!idToken || !targetUid || !newPassword) {
      return res.status(400).json({ error: "Missing required fields: idToken, targetUid, newPassword" });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const requesterUid = decodedToken.uid;
      const userDoc = await getDoc(doc(db, "users", requesterUid));
      if (!userDoc.exists() || userDoc.data().role !== "admin") {
        return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
      }

      await admin.auth().updateUser(targetUid, { password: newPassword });
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      console.error("Admin update-password error:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // API Route: Admin Ban IP
  app.post("/api/admin/ban-ip", async (req, res) => {
    const { idToken, ip } = req.body;
    if (!idToken || !ip) return res.status(400).json({ error: "Missing fields" });

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userDoc = await getDoc(doc(db, "users", decodedToken.uid));
      if (userDoc.data()?.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

      const bannedRef = doc(db, "banned_ips", ip.replace(/\./g, "_"));
      await setDoc(bannedRef, {
        ip: ip,
        bannedAt: admin.firestore.Timestamp.now(),
        reason: "Admin manual ban",
        bannedBy: decodedToken.uid
      });

      res.json({ success: true, message: `IP ${ip} banned successfully` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Admin Delete User
  app.post("/api/admin/delete-user", async (req, res) => {
    const { idToken, targetUid } = req.body;
    if (!idToken || !targetUid) return res.status(400).json({ error: "Missing fields" });

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userDoc = await getDoc(doc(db, "users", decodedToken.uid));
      if (userDoc.data()?.role !== "admin") return res.status(403).json({ error: "Unauthorized" });

      // Delete from Auth
      await admin.auth().deleteUser(targetUid);
      // Logic for deleting from Firestore users collection is usually handled by rules/cleanup, 
      // but let's do it here for completeness
      // await admin.firestore().collection('users').doc(targetUid).delete();

      res.json({ success: true, message: "User deleted successfully from authentication" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: User Posts (Requested by user)
  app.get("/api/user-posts", async (req, res) => {
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: "userId parameter is required" });
    }

    try {
      console.log(`Fetching posts for user: ${userId}`);
      const postsRef = collection(db, "posts");
      const q = query(postsRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      
      const posts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Map to the format expected by the user's HTML snippet
      // The snippet expects { title, content }
      const formattedPosts = posts.map((p: any) => ({
        id: p.id,
        title: p.caption ? (p.caption.substring(0, 30) + (p.caption.length > 30 ? "..." : "")) : "Untitled Post",
        content: p.caption || "",
        timestamp: p.timestamp
      }));

      res.json(formattedPosts);
    } catch (error: any) {
      console.error("Error fetching user posts:", error);
      res.status(500).json({ error: "Failed to fetch posts", details: error.message });
    }
  });

  // API Route: Get Users List
  app.get("/api/users", async (req, res) => {
    try {
      const DEMOTED_EMAILS = [
        'selfrole_1783853030461_4jdl3o@example.com',
        'probe.r8.2026@gmail.com',
        'pentest_test_2026@imchat.im',
        'yilin199924@gmail.com',
        'r16probe1788304828@xmail.co',
        'wei34432ming@gmail.com',
        'ctfhacker777@example.com'
      ];
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs.map(doc => {
        const data = doc.data();
        const email = (data.email || '').toLowerCase().trim();
        const isDemoted = DEMOTED_EMAILS.includes(email);
        return {
          id: doc.id,
          ...data,
          role: isDemoted ? 'user' : (data.role || 'user')
        };
      });
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users", details: error.message });
    }
  });

  // API Route: Fetch and parse Google News RSS Feed
  app.get("/api/news", async (req, res) => {
    const category = (req.query.category as string || "top").toUpperCase();
    
    // Category mapping to Google News RSS sections
    const categoryMap: { [key: string]: string } = {
      TOP: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
      WORLD: "https://news.google.com/rss/sections/topics/WORLD?hl=en-US&gl=US&ceid=US:en",
      TECHNOLOGY: "https://news.google.com/rss/sections/topics/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en",
      BUSINESS: "https://news.google.com/rss/sections/topics/BUSINESS?hl=en-US&gl=US&ceid=US:en",
      SCIENCE: "https://news.google.com/rss/sections/topics/SCIENCE?hl=en-US&gl=US&ceid=US:en",
      ENTERTAINMENT: "https://news.google.com/rss/sections/topics/ENTERTAINMENT?hl=en-US&gl=US&ceid=US:en",
      SPORTS: "https://news.google.com/rss/sections/topics/SPORTS?hl=en-US&gl=US&ceid=US:en",
      HEALTH: "https://news.google.com/rss/sections/topics/HEALTH?hl=en-US&gl=US&ceid=US:en"
    };

    const targetUrl = categoryMap[category] || categoryMap.TOP;

    try {
      console.log(`[Google News] Fetching RSS feed for category: ${category} from ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from Google News, status: ${response.status}`);
      }

      const xmlText = await response.text();
      const articles = parseGoogleNewsRSS(xmlText, category);
      
      res.json({ success: true, category, articles });
    } catch (e: any) {
      console.warn("[Google News] RSS fetch/parse failed. Serving fallback mock articles.", e.message);
      
      // Serve beautiful local mock fallback articles matching the requested category
      const fallbacks = getFallbackNews(category);
      res.json({ success: true, category, articles: fallbacks, isFallback: true });
    }
  });

  // Helper functions for Google News Parsing & Fallbacks
  function parseGoogleNewsRSS(xml: string, category: string): any[] {
    const items: any[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    
    const categoryImages: { [key: string]: string[] } = {
      TECHNOLOGY: [
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop"
      ],
      BUSINESS: [
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop"
      ],
      SCIENCE: [
        "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1447069387593-a5de0862481e?w=600&auto=format&fit=crop"
      ],
      ENTERTAINMENT: [
        "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop"
      ],
      SPORTS: [
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&auto=format&fit=crop"
      ],
      HEALTH: [
        "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop"
      ],
      WORLD: [
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop"
      ],
      DEFAULT: [
        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1495020689067-958852a6565d?w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504711331083-9c895941bf81?w=600&auto=format&fit=crop"
      ]
    };

    const images = categoryImages[category.toUpperCase()] || categoryImages.DEFAULT;

    const cleanTag = (str: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
      const m = str.match(regex);
      if (!m) return '';
      let content = m[1];
      content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
      content = content.replace(/<[^>]*>/g, '');
      return content.trim();
    };

    const getLink = (str: string): string => {
      const m = str.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      if (m) {
        return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
      }
      const m2 = str.match(/<link>([^<\s]+)/i);
      return m2 ? m2[1].trim() : '';
    };

    let idx = 0;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 25) {
      const itemContent = match[1];
      const fullTitle = cleanTag(itemContent, 'title');
      
      let title = fullTitle;
      let source = 'Google News';
      const sourceIndex = fullTitle.lastIndexOf(' - ');
      if (sourceIndex > 0) {
        title = fullTitle.substring(0, sourceIndex).trim();
        source = fullTitle.substring(sourceIndex + 3).trim();
      }

      const link = getLink(itemContent);
      const pubDate = cleanTag(itemContent, 'pubDate');
      const descriptionRaw = cleanTag(itemContent, 'description');
      
      // Clean description of links/HTML
      const description = descriptionRaw ? descriptionRaw.split("&nbsp;")[0].split("Read Full Story")[0].trim() : "";
      
      const image = images[idx % images.length];
      
      if (title && link) {
        items.push({
          id: `news-${Date.now()}-${idx}`,
          title,
          url: link,
          pubDate,
          description: description || "Read the full story on Google News.",
          source,
          image,
          category: category.toLowerCase()
        });
        idx++;
      }
    }
    return items;
  }

  function getFallbackNews(category: string): any[] {
    const defaultFallbacks = [
      {
        id: "fall-1",
        title: "Pioneering Tech Hub Unveils Next-Generation AI Agent Platforms",
        url: "https://news.google.com",
        pubDate: new Date().toUTCString(),
        description: "A leading AI collective showcased autonomous team orchestration engines that dynamically build, compile, and run client-server apps with high fidelity.",
        source: "TechPulse",
        image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop",
        category: "technology"
      },
      {
        id: "fall-2",
        title: "Global Markets Stabilize Following High-Yield Tech Rebounds",
        url: "https://news.google.com",
        pubDate: new Date().toUTCString(),
        description: "Tech shares surged, bringing standard indices back into stable territory. Analysts claim strong digital cloud transformation plans led the charge.",
        source: "MarketWatch",
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop",
        category: "business"
      },
      {
        id: "fall-3",
        title: "Deep Space Telescope Identifies Atmospheric Elements on Earth-sized Exoplanet",
        url: "https://news.google.com",
        pubDate: new Date().toUTCString(),
        description: "Spectrometric data confirms presence of complex carbon and water vapor indicators on a close rocky planet, setting off new exploration waves.",
        source: "CosmicDiscover",
        image: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600&auto=format&fit=crop",
        category: "science"
      },
      {
        id: "fall-4",
        title: "Renowned Modern Museum Announces Fully Immersive 3D Digital Art Wing",
        url: "https://news.google.com",
        pubDate: new Date().toUTCString(),
        description: "The museum launches an interactive canvas experience with real-time reactive shaders and dynamic soundscapes that visitors can control.",
        source: "ArtCurrent",
        image: "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=600&auto=format&fit=crop",
        category: "entertainment"
      },
      {
        id: "fall-5",
        title: "Championship Finals Break All-Time Stadium Viewership Records",
        url: "https://news.google.com",
        pubDate: new Date().toUTCString(),
        description: "An incredibly close overtime finish drew a massive multi-channel streaming audience, highlighting a monumental shift toward interactive fan broadcasts.",
        source: "SportLine",
        image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop",
        category: "sports"
      }
    ];

    const matched = defaultFallbacks.filter(f => f.category === category.toLowerCase());
    return matched.length > 0 ? matched : defaultFallbacks;
  }

  // --- Media Deletion Workflows ---

  // Authentication Middleware
  async function authenticateUser(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Request Deletion
  app.post('/api/media/:mediaId/request-delete', authenticateUser, async (req: any, res: any) => {
    const { mediaPassword } = req.body;
    const mediaId = req.params.mediaId;
    const userId = req.user.uid;

    try {
      const mediaRef = admin.firestore().collection('media').doc(mediaId);
      const mediaSnap = await mediaRef.get();

      if (!mediaSnap.exists) return res.status(404).json({ error: 'Media not found' });
      const mediaData = mediaSnap.data()!;

      if (mediaData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

      // Verify Password (if set)
      if (mediaData.password && mediaData.password !== mediaPassword) {
        return res.status(403).json({ error: 'Incorrect media password' });
      }

      // Generate deletion token and expiry
      const deletionToken = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      await mediaRef.update({
        deletionRequested: true,
        deletionToken: deletionToken,
        deletionTokenExpiry: expiry,
        deletionConfirmed: false,
        deletionRequestTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Send confirmation email
      const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const confirmationLink = `${appUrl}/api/media/confirm-delete?token=${deletionToken}`;

      // Config transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"IMChat" <${process.env.FROM_EMAIL || 'no-reply@imchat.app'}>`,
        to: req.user.email,
        subject: 'Confirm Your Media Deletion',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #ef4444;">Media Deletion Request</h2>
            <p>You requested to delete a media item from IMChat. Please confirm this action by clicking the button below:</p>
            <a href="${confirmationLink}" style="display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Confirm Deletion</a>
            <p style="color: #666; font-size: 0.9rem;">This link will expire in 24 hours.</p>
            <p style="color: #999; font-size: 0.8rem; border-top: 1px solid #eee; padding-top: 10px;">If you didn't request this, you can ignore this email.</p>
          </div>
        `
      });

      res.json({ message: 'Deletion confirmation email sent. Please check your inbox.' });
    } catch (err: any) {
      console.error("Deletion request error:", err);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  });

  // Confirm Deletion (via GET link in email)
  app.get('/api/media/confirm-delete', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing token');

    try {
      const mediaCollection = admin.firestore().collection('media');
      const q = await mediaCollection.where('deletionToken', '==', token).limit(1).get();

      if (q.empty) return res.status(400).send('Invalid or expired token');
      
      const mediaDoc = q.docs[0];
      const mediaData = mediaDoc.data();

      if (mediaData.deletionTokenExpiry < Date.now()) {
        return res.status(400).send('Token expired');
      }

      // Mark as confirmed and delete
      // The user snippet suggests confirming then deleting.
      await mediaDoc.ref.delete();

      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; text-align: center;">
            <div style="padding: 40px; background: white; border-radius: 20px; shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
              <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
              <h1 style="color: #166534; margin-bottom: 10px;">Media Deleted</h1>
              <p style="color: #15803d;">Your media has been deleted successfully.</p>
              <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Return to App</a>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("Confirmation error:", err);
      res.status(500).send('An error occurred during deletion.');
    }
  });

  // Manual Delete (Final check)
  app.delete('/api/media/:mediaId', authenticateUser, async (req: any, res: any) => {
    const mediaId = req.params.mediaId;
    const userId = req.user.uid;

    try {
      const mediaRef = admin.firestore().collection('media').doc(mediaId);
      const mediaSnap = await mediaRef.get();

      if (!mediaSnap.exists) return res.status(404).json({ error: 'Media not found' });
      const mediaData = mediaSnap.data()!;

      // Check ownership
      if (mediaData.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

      if (!mediaData.deletionConfirmed) {
        return res.status(403).json({ error: 'Deletion not confirmed by user via email' });
      }

      await mediaRef.delete();
      res.json({ message: 'Media deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Automated Welcome Email Service ---
  function getEmailTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return null;
  }

  function generateWelcomeEmailHtml(name: string, username: string, appUrl: string) {
    const safeName = name || 'Friend';
    const safeUsername = username || 'user';
    const currentYear = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to IMChat</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #7e22ce 0%, #9333ea 50%, #4f46e5 100%); padding: 40px 30px; text-align: center;">
      <div style="display: inline-block; background: #ffffff; border-radius: 16px; padding: 10px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQBJVFxs5w38N3KpXM8ed1fHT_uBoz97uc8gU7VUGnpEDrhFiIq_f0zob3dweIVTEaF_8Opge3uX_Ed1QVh2ADZCcnyZ2xXwPIX9Nl089uWBxZAjqr0jgSfr6DBReyZKmeyI_6MFuS0RajgWyg0_K2ijPWrtk6VsSo5waSR9HOtf-4hs4BMwtwPh6g6vk/s1600/9519a766-e328-404a-b18e-7b7b6d029a15-removebg-preview~2.png" alt="IMChat" style="width: 48px; height: 48px; display: block;" />
      </div>
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Welcome to IMChat! 🎉</h1>
      <p style="color: #e9d5ff; margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">We're thrilled to have you in our community</p>
    </div>

    <!-- Main Body -->
    <div style="padding: 36px 30px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">Hello ${safeName},</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 12px 0 24px 0;">
        Your account <strong>@${safeUsername}</strong> is successfully set up and ready to go! IMChat brings together real-time social chatting, private media storage, short reels, and AI creative tools into one fluid experience.
      </p>

      <!-- Feature Highlights -->
      <div style="background-color: #f8fafc; border-radius: 14px; padding: 20px; margin-bottom: 28px; border: 1px solid #f1f5f9;">
        <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 16px 0; font-weight: 700;">🚀 Quick Start Guide:</h3>
        
        <div style="margin-bottom: 16px;">
          <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 3px;">💬 Instant Messaging & Group Chats</div>
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4;">Send direct messages, create group spaces, record voice notes, and make high-definition video calls.</p>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 3px;">📸 Media Storage & Privacy Controls</div>
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4;">Store photos and videos with customizable privacy (Public, Followers Only, or Private) and share directly to feeds or chats.</p>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 3px;">🎬 Reels & Community Feeds</div>
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4;">Explore short video reels, follow creator updates, and post moments with rich filters and audio.</p>
        </div>

        <div>
          <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 3px;">✨ AI Creative Studio & Custom Bell Tones</div>
          <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4;">Generate images, music, and video concepts with AI, and personalize your notifications with custom ring bells.</p>
        </div>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 32px 0 24px 0;">
        <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #7e22ce, #9333ea); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.35);">
          Open IMChat App &rarr;
        </a>
      </div>

      <!-- Security Notice -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 24px;">
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
          🔒 <strong>Security Tip:</strong> IMChat will never ask for your password via email. If you did not sign up for this account, please ignore this message.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0;">
        &copy; ${currentYear} IMChat. All rights reserved.
      </p>
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">
        Sent automatically to new app members.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // API Route: Send Welcome Email Automatically to New Users
  app.post('/api/send-welcome-email', async (req: any, res: any) => {
    const { email, name, username, userId } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid recipient email address is required' });
    }

    const emailLower = email.trim().toLowerCase();
    // Skip internal or dummy phone emails
    if (emailLower.endsWith('@imchat.im') && emailLower.startsWith('+')) {
      return res.json({ success: true, skipped: true, message: 'Skipped placeholder phone email' });
    }

    try {
      const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const emailHtml = generateWelcomeEmailHtml(name, username, appUrl);
      const transporter = getEmailTransporter();
      let sentStatus = 'simulated';
      let errorDetail = null;

      if (transporter) {
        try {
          await transporter.sendMail({
            from: `"IMChat Welcome" <${process.env.FROM_EMAIL || 'no-reply@imchat.app'}>`,
            to: emailLower,
            subject: `Welcome to IMChat, ${name || 'Friend'}! 🎉`,
            html: emailHtml,
          });
          sentStatus = 'delivered';
        } catch (mailErr: any) {
          console.warn("SMTP send failed, falling back to simulated log:", mailErr.message);
          sentStatus = 'fallback_logged';
          errorDetail = mailErr.message;
        }
      } else {
        console.log(`[Auto Welcome Email] Transporter not configured. Welcome email queued for ${emailLower} (${name})`);
      }

      // Record welcome email activity in Firestore
      try {
        await admin.firestore().collection('welcome_email_logs').add({
          email: emailLower,
          name: name || '',
          username: username || '',
          userId: userId || null,
          status: sentStatus,
          errorDetail,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        if (userId) {
          await admin.firestore().collection('users').doc(userId).set({
            welcomeEmailSent: true,
            welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            welcomeEmailStatus: sentStatus
          }, { merge: true });
        }
      } catch (logErr) {
        console.warn("Could not save welcome email log to Firestore:", logErr);
      }

      res.json({ 
        success: true, 
        message: 'Welcome email sent successfully!', 
        status: sentStatus 
      });
    } catch (err: any) {
      console.error("send-welcome-email error:", err);
      res.status(500).json({ error: 'Failed to dispatch welcome email', details: err.message });
    }
  });

  // API Route: Test Welcome Email
  app.post('/api/test-welcome-email', async (req: any, res: any) => {
    const { email, name, username } = req.body;
    const targetEmail = email || 'test@example.com';
    const targetName = name || 'New Member';
    const targetUsername = username || 'new_user';

    try {
      const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const emailHtml = generateWelcomeEmailHtml(targetName, targetUsername, appUrl);
      const transporter = getEmailTransporter();

      if (transporter) {
        await transporter.sendMail({
          from: `"IMChat Welcome Test" <${process.env.FROM_EMAIL || 'no-reply@imchat.app'}>`,
          to: targetEmail,
          subject: `[Test] Welcome to IMChat, ${targetName}! 🎉`,
          html: emailHtml,
        });
        return res.json({ success: true, message: `Test welcome email sent to ${targetEmail} via SMTP!` });
      } else {
        return res.json({ 
          success: true, 
          simulated: true, 
          message: `Welcome email template generated successfully for ${targetEmail}! (SMTP is not configured in environment variables, email was logged to system).` 
        });
      }
    } catch (err: any) {
      console.error("test-welcome-email error:", err);
      res.status(500).json({ error: err.message || 'Failed to send test email' });
    }
  });

  // --- Automated Password Reset on Failed Login Attempts ---
  function generatePasswordResetEmailHtml(name: string, username: string, resetLink: string, appUrl: string) {
    const safeName = name || 'Friend';
    const safeUsername = username || 'user';
    const currentYear = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your IMChat Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <div style="max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #d97706 100%); padding: 36px 30px; text-align: center;">
      <div style="display: inline-block; background: #ffffff; border-radius: 16px; padding: 10px; margin-bottom: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQBJVFxs5w38N3KpXM8ed1fHT_uBoz97uc8gU7VUGnpEDrhFiIq_f0zob3dweIVTEaF_8Opge3uX_Ed1QVh2ADZCcnyZ2xXwPIX9Nl089uWBxZAjqr0jgSfr6DBReyZKmeyI_6MFuS0RajgWyg0_K2ijPWrtk6VsSo5waSR9HOtf-4hs4BMwtwPh6g6vk/s1600/9519a766-e328-404a-b18e-7b7b6d029a15-removebg-preview~2.png" alt="IMChat" style="width: 44px; height: 44px; display: block;" />
      </div>
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Security Alert: 3 Failed Login Attempts</h1>
      <p style="color: #ffedd5; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">Automated Password Reset Link for @${safeUsername}</p>
    </div>

    <!-- Main Body -->
    <div style="padding: 36px 30px;">
      <h2 style="font-size: 19px; font-weight: 700; color: #0f172a; margin-top: 0;">Hello ${safeName},</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 12px 0 20px 0;">
        We noticed <strong>3 consecutive failed login attempts</strong> to your IMChat account (<strong>@${safeUsername}</strong>).
      </p>
      
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
        To protect your account and help you regain access securely, we have automatically sent this password reset link to your registered email address.
      </p>

      <!-- Reset Action Card -->
      <div style="background-color: #fef2f2; border-radius: 14px; padding: 22px; margin-bottom: 26px; border: 1px solid #fee2e2; text-align: center;">
        <p style="font-size: 14px; font-weight: 600; color: #991b1b; margin: 0 0 16px 0;">
          Click the secure button below to choose a new password:
        </p>
        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #dc2626, #b91c1c); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 34px; border-radius: 12px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);">
          Reset Password Now &rarr;
        </a>
        <p style="font-size: 12px; color: #991b1b; margin: 14px 0 0 0;">
          Or copy and paste this link in your browser:<br/>
          <a href="${resetLink}" style="color: #dc2626; word-break: break-all; font-size: 11px;">${resetLink}</a>
        </p>
      </div>

      <!-- Security Guidance -->
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">🔒 Security Recommendations:</h4>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #64748b; line-height: 1.5;">
          <li>If you were trying to log in, simply click the button above to set a new password.</li>
          <li>If you did NOT attempt to log in, we recommend resetting your password immediately to protect your account.</li>
          <li>Never share this reset link or verification codes with anyone.</li>
        </ul>
      </div>

      <!-- Back to App -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}" style="color: #64748b; font-size: 13px; text-decoration: underline; font-weight: 600;">
          Return to IMChat App
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0;">
        &copy; ${currentYear} IMChat Security. All rights reserved.
      </p>
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">
        Automated security alert triggered after 3 unsuccessful login attempts.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  // API Route: Automated Password Reset after 3 failed login attempts
  app.post('/api/auth/auto-password-reset', async (req: any, res: any) => {
    const { emailOrUsername, attemptsCount = 3 } = req.body;
    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      return res.status(400).json({ error: 'Email or username is required' });
    }

    const inputVal = emailOrUsername.trim().toLowerCase();
    const appUrl = process.env.APP_URL || `http://${req.headers.host}`;

    try {
      let targetEmail = inputVal;
      let userName = 'User';
      let userFullName = '';
      let userUid = '';

      // Look up user in Firestore
      const usersCollection = admin.firestore().collection('users');
      if (inputVal.includes('@')) {
        const qEmail = await usersCollection.where('email', '==', inputVal).limit(1).get();
        if (!qEmail.empty) {
          const uDoc = qEmail.docs[0];
          const uData = uDoc.data();
          targetEmail = uData.email || inputVal;
          userName = uData.username || 'user';
          userFullName = uData.name || '';
          userUid = uDoc.id;
        }
      } else {
        // Look up by username
        const qUsername = await usersCollection.where('username', '==', inputVal).limit(1).get();
        if (!qUsername.empty) {
          const uDoc = qUsername.docs[0];
          const uData = uDoc.data();
          targetEmail = uData.email || '';
          userName = uData.username || inputVal;
          userFullName = uData.name || '';
          userUid = uDoc.id;
        }
      }

      if (!targetEmail || !targetEmail.includes('@')) {
        return res.status(404).json({ error: 'No registered user found with that identifier.' });
      }

      // Generate password reset link
      let resetLink = `${appUrl}/?mode=login&resetEmail=${encodeURIComponent(targetEmail)}`;
      try {
        if (admin.auth) {
          resetLink = await admin.auth().generatePasswordResetLink(targetEmail);
        }
      } catch (authGenErr: any) {
        console.warn("Could not generate Admin Auth reset link, using fallback app reset url:", authGenErr.message);
      }

      const emailHtml = generatePasswordResetEmailHtml(userFullName || userName, userName, resetLink, appUrl);
      const transporter = getEmailTransporter();
      let sentStatus = 'simulated';
      let errorDetail = null;

      if (transporter) {
        try {
          await transporter.sendMail({
            from: `"IMChat Security" <${process.env.FROM_EMAIL || 'security@imchat.app'}>`,
            to: targetEmail,
            subject: `🔐 Security Alert: Password Reset Link for @${userName} (3 Failed Logins)`,
            html: emailHtml,
          });
          sentStatus = 'delivered';
        } catch (mailErr: any) {
          console.warn("SMTP send failed for password reset:", mailErr.message);
          sentStatus = 'fallback_logged';
          errorDetail = mailErr.message;
        }
      } else {
        console.log(`[Auto Password Reset] Transporter not configured. Reset link generated for ${targetEmail} (@${userName}): ${resetLink}`);
      }

      // Record security event in Firestore
      try {
        await admin.firestore().collection('password_reset_logs').add({
          email: targetEmail,
          username: userName,
          userId: userUid || null,
          reason: '3_failed_login_attempts',
          attemptsCount: attemptsCount || 3,
          resetLink,
          status: sentStatus,
          errorDetail,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add security notification to user's notifications collection
        if (userUid) {
          await admin.firestore().collection('notifications').add({
            userId: userUid,
            type: 'security_alert',
            text: '⚠️ 3 failed login attempts were detected on your account. A password reset link has been dispatched to your email.',
            read: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (logErr) {
        console.warn("Could not log password reset event to Firestore:", logErr);
      }

      // Mask email for privacy
      const parts = targetEmail.split('@');
      const maskedLocal = parts[0].length > 3 
        ? `${parts[0].slice(0, 2)}***${parts[0].slice(-1)}`
        : `${parts[0].slice(0, 1)}***`;
      const maskedEmail = `${maskedLocal}@${parts[1]}`;

      res.json({
        success: true,
        message: `A password reset link has been automatically dispatched to your registered email (${maskedEmail}).`,
        email: maskedEmail,
        targetEmail,
        username: userName,
        resetLink
      });

    } catch (err: any) {
      console.error("auto-password-reset endpoint error:", err);
      res.status(500).json({ error: 'Failed to process password reset request', details: err.message });
    }
  });

  // AI tools for Reels using Gemini 3.5 Flash
  app.post('/api/reels/ai-tool', async (req: any, res: any) => {
    const { action, prompt, caption } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action parameter' });

    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: 'Gemini API is not configured on this application server yet.' });
      }

      let systemInstruction = "You are a specialized AI reels director and viral content writer.";
      let userPrompt = "";

      if (action === 'generate_script') {
        systemInstruction = "You are a professional social media scriptwriter and short-form video director. Write an engaging, catchy, 30-second script based on the topic provided. Break it down into clear visual cues/actions and spoken narration.";
        userPrompt = `Write a high-retention 30-second video script about: "${prompt}"`;
      } else if (action === 'generate_hashtags') {
        systemInstruction = "You are an expert social media indexer. Generate a list of 10 relevant, trending hashtags with '#' tag prefixes for the provided text.";
        userPrompt = `Generate 10 trending hashtags for the following content: "${caption || prompt}"`;
      } else if (action === 'refine_caption') {
        systemInstruction = "You are a copywriter. Refine the provided video caption to be highly clickable, engaging, and readable. Keep the final response short and punchy within 160 characters.";
        userPrompt = `Refine and improve this reel caption: "${caption}"`;
      } else if (action === 'generate_music_track') {
        systemInstruction = `You are a master AI Music Composer and Audio Producer for short viral reels and videos.
Generate a structured musical soundtrack profile matching the requested vibe or topic.
Return ONLY valid JSON matching this schema with no markdown formatting:
{
  "title": "Creative Track Title",
  "artist": "AI Sound Producer Name (e.g. NeonBeat AI, Gemini SoundLab)",
  "genre": "Genre name (e.g. Synthwave, Lofi, Cyberpunk, Cinematic, Deep House, Phonk, Chillhop)",
  "bpm": 120,
  "mood": "Mood description (e.g. Energetic & Euphoric)",
  "synthPreset": "one of: synthwave, lofi, groove, techno, orchestral, ambient, phonk, cyberpunk",
  "melodyNotes": [440, 523.25, 659.25, 587.33, 440],
  "description": "Short 1-sentence description of the track soundscape",
  "isPaid": false,
  "badge": "⚡ AI Generated"
}`;
        userPrompt = `Compose an AI sound track for a viral reel with prompt/style: "${prompt || 'Upbeat Viral Trend'}"`;
      } else {
        return res.status(400).json({ error: 'Unsupported AI tool action.' });
      }

      // Query the Gemini SDK
      const response = await getAiClient().models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.8
        }
      });

      if (action === 'generate_music_track') {
        try {
          const rawText = response.text || "{}";
          const jsonStr = rawText.replace(/```json\s*|\s*```/g, '').trim();
          const parsed = JSON.parse(jsonStr);
          return res.json({ result: parsed });
        } catch (parseErr) {
          return res.json({
            result: {
              title: prompt ? `${prompt} (AI Mix)` : "Cyber Groove Alpha",
              artist: "Gemini SoundLab AI",
              genre: "Electronic AI",
              bpm: 128,
              mood: "Hypnotic & Viral",
              synthPreset: "synthwave",
              melodyNotes: [440, 554.37, 659.25, 880],
              description: "Procedurally generated AI soundtrack for high-retention video reels.",
              isPaid: false,
              badge: "⚡ AI Generated"
            }
          });
        }
      }

      res.json({ result: response.text });
    } catch (err: any) {
      console.error("AI Reels API error:", err);
      res.status(500).json({ error: err.message || 'AI Generation failed' });
    }
  });

  // API Route: Turn blog posts, scripts, or product descriptions into structured visual storyboard/videoprompts
  app.post('/api/video/convert-text', async (req: any, res: any) => {
    const { text, type, mood } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: 'Gemini API is not configured on this application server yet.' });
      }

      const promptMsg = `You are a master storyboard artist and video director for Veo, a cutting-edge AI video generation model. 
Your task is to transform the user's input text (which is a ${type || 'description'}) with a visual mood of '${mood || 'cinematic'}' into a highly structured video storyboard, an optimized overall visual prompt, and an elegant voiceover.

User Input Text:
"${text}"

Your response MUST be a valid JSON object matching this TypeScript structure, with no markdown styling around it, containing pure JSON:
{
  "optimizedPrompt": "A single, highly detailed, visually descriptive 1-2 sentence prompt that encapsulates the main subject or essence of the text, styled with cinematic lighting, camera movements, and the requested mood, perfectly tailored for video generation.",
  "voiceover": "An elegant, continuous narrative voiceover script generated and refined from the user text, optimized for voiceovers.",
  "scenes": [
    {
      "title": "Scene Name or Sequence Number (e.g., Intro, Scene 1)",
      "visualCue": "A brief, action-oriented description of what happens visually in this specific scene.",
      "recommendedVeoPrompt": "A highly detailed, visually descriptive creative prompt tailored specifically for Veo, describing the scene's objects, camera angle, atmospheric lighting, and actions matching the specified mood of '${mood || 'cinematic'}'. Make it self-contained.",
      "durationEstimate": "Estimated duration (e.g., 5 seconds)"
    }
  ]
}`;

      const response = await getAiClient().models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptMsg,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText.trim());
        res.json(parsed);
      } catch (parseErr) {
        console.error("Failed to parse Gemini JSON:", responseText, parseErr);
        res.json({
          optimizedPrompt: text.substring(0, 150) + ` Style: ${mood || 'Cinematic'}`,
          voiceover: text,
          scenes: [
            {
              title: "Scene 1",
              visualCue: "Text visualization",
              recommendedVeoPrompt: text,
              durationEstimate: "5 seconds"
            }
          ]
        });
      }
    } catch (err: any) {
      console.error("Video Script API error:", err);
      res.status(500).json({ error: err.message || 'AI script analysis failed' });
    }
  });

  // API Route: Generate AI Music Metadata securely on the server
  app.post('/api/music/generate', async (req: any, res: any) => {
    const { prompt, genreName, genreId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }

    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: 'Gemini API is not configured on this application server yet.' });
      }

      const response = await getAiClient().models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Generate a music track creation representation.
You are tasked with generating beautiful and creative music metadata for the requested prompt: "${prompt}" and styled as a "${genreName || 'Music'}".

Provide a structured response. Use EXACTLY the following format:
TITLE: <A short, beautifully matching song title>
ARTIST: AI IMChat Studio • <Creative producer pseudonym>
LYRICS: <Generate beautiful, short poetic lyrics / song structure corresponding perfectly to the vibe. No headers, just 6-8 elegantly spaced lines>`
      });

      const text = response.text || '';
      
      let title = '';
      let artist = '';
      let lyricLines: string[] = [];
      let captureLyrics = false;

      const lines = text.split('\n');
      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('TITLE:')) {
          title = trimmed.replace('TITLE:', '').trim();
        } else if (trimmed.startsWith('ARTIST:')) {
          artist = trimmed.replace('ARTIST:', '').trim();
        } else if (trimmed.startsWith('LYRICS:')) {
          captureLyrics = true;
          const lyricsStart = trimmed.replace('LYRICS:', '').trim();
          if (lyricsStart) lyricLines.push(lyricsStart);
        } else if (captureLyrics) {
          if (trimmed) lyricLines.push(trimmed);
        }
      });

      res.json({
        title: title || `Genesis of ${genreName || 'Music'}`,
        artist: artist || 'AI IMChat Studio',
        lyrics: lyricLines.join('\n') || '[Instrumental Atmosphere Electronic Elements]'
      });

    } catch (err: any) {
      console.error("AI Music API error:", err);
      res.status(500).json({ error: err.message || 'AI Music Generation failed' });
    }
  });

  // API Route: Generate AI Image securely on the server
  app.post('/api/image/generate', async (req: any, res: any) => {
    const { prompt, stylePrompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }

    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: 'Gemini API is not configured on this application server yet.' });
      }

      const fullPrompt = `${prompt}${stylePrompt || ''}`;
      
      const response = await getAiClient().models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio as any || '1:1',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64Bytes = response.generatedImages[0].image.imageBytes;
        res.json({ success: true, base64: base64Bytes });
      } else {
        res.status(500).json({ error: 'No image was generated by the model' });
      }
    } catch (err: any) {
      console.error("AI Image API error:", err);
      res.status(500).json({ error: err.message || 'AI Image Generation failed' });
    }
  });

  // API Route: AI Studio for Content Creators using Gemini 3.5 Flash
  app.post('/api/ai-studio', async (req: any, res: any) => {
    const { action, prompt, secondaryInput, niche } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action parameter' });

    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: 'Gemini API is not configured on this application server yet.' });
      }

      let systemInstruction = "You are a world-class AI Creator strategist and viral content writer.";
      let userPrompt = "";

      if (action === 'caption_hashtags') {
        systemInstruction = "You are an expert social media strategist and copywriting genius. For the provided content or topic, create 3 engaging caption variations (e.g. catchy/humorous, professional/informative, short/mysterious) and a curated list of 15 trending, high-engagement hashtags sorted by size/relevance.";
        userPrompt = `Generate captions and hashtags for this topic or raw draft: "${prompt}". Target audience/niche: ${niche || 'General'}`;
      } else if (action === 'video_script') {
        systemInstruction = "You are a professional cinematic video director and scriptwriter for short-form video formats (Reels, TikTok, Shorts). Create a highly engaging 30-to-60 second video script for the given topic. Include timestamp indicators, visual cues, sound effects (SFX), background music suggestion, and voiceover/on-screen text (HUD). Ensure the hook in the first 3 seconds is incredibly catchy.";
        userPrompt = `Write a viral video script about: "${prompt}". Style/Tone: ${secondaryInput || 'energetic and fast-paced'}`;
      } else if (action === 'niche_strategy') {
        systemInstruction = "You are an elite influencer growth consultant and brand director. Based on the selected niche, provide an actionable weekly content calendar, recommended video styles (e.g. tutorials, transitions, storytimes), trending sound usage tips, and optimal times of day to post with maximum engagement metrics.";
        userPrompt = `Provide a growth blueprint and content calendar for the niche: "${niche || prompt}"`;
      } else if (action === 'rate_titles') {
        systemInstruction = "You are a click-through rate (CTR) optimization expert for digital creators. Analyze the two title or headline options provided. Grade each out of 10 for clickability, clarity, and curiosity. Then, provide 3 rewritten, highly optimized, viral titles that will maximize engagement without being deceptive.";
        userPrompt = `Compare and rate these titles: Option A: "${prompt}" vs Option B: "${secondaryInput}".`;
      } else {
        return res.status(400).json({ error: 'Unsupported AI Studio action.' });
      }

      const response = await getAiClient().models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.75
        }
      });

      res.json({ result: response.text });
    } catch (err: any) {
      console.error("AI Studio API error:", err);
      res.status(500).json({ error: err.message || 'AI Generation failed' });
    }
  });

  // API Route: Push Real App Code, Data, and App Icons to GitHub
  app.post('/api/github/sync', async (req: any, res: any) => {
    const { githubToken, repoOwner, repoName, branch = 'main', commitMessage } = req.body;
    if (!githubToken || !repoOwner || !repoName) {
      return res.status(400).json({ error: 'GitHub Personal Access Token, Repo Owner, and Repo Name are required.' });
    }

    try {
      // Collect files to sync including real app data and app icons
      const filesToSync: { path: string; content: string }[] = [];

      // Add project config & metadata files
      const filePaths = [
        'metadata.json',
        'public/manifest.json',
        'index.html',
        'package.json',
        'capacitor.config.json',
        'src/App.tsx',
        'src/HomeFeed.tsx',
        'src/UserProfile.tsx',
        'src/SettingsPage.tsx',
        'src/AdminDashboard.tsx',
        'src/types.ts',
        'src/main.tsx'
      ];

      for (const fp of filePaths) {
        const fullPath = path.join(process.cwd(), fp);
        if (fs.existsSync(fullPath)) {
          filesToSync.push({
            path: fp,
            content: fs.readFileSync(fullPath, 'utf8')
          });
        }
      }

      // Generate a snapshot of real app database data
      let snapshotData: any = { syncedAt: new Date().toISOString(), app: "IMChat" };
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const postsSnap = await getDocs(collection(db, "posts"));
        snapshotData.usersCount = usersSnap.size;
        snapshotData.postsCount = postsSnap.size;
        snapshotData.usersSample = usersSnap.docs.slice(0, 50).map(d => ({ id: d.id, ...d.data() }));
        snapshotData.postsSample = postsSnap.docs.slice(0, 50).map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn("Could not fetch full Firestore snapshot for GitHub sync:", err);
      }

      filesToSync.push({
        path: 'data/app-real-data-backup.json',
        content: JSON.stringify(snapshotData, null, 2)
      });

      // Push each file to GitHub REST API
      const pushedFiles: string[] = [];
      for (const item of filesToSync) {
        const fileUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${item.path}`;
        
        let sha: string | undefined;
        try {
          const checkRes = await fetch(fileUrl + `?ref=${branch}`, {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'aistudio-build'
            }
          });
          if (checkRes.ok) {
            const checkData: any = await checkRes.json();
            sha = checkData.sha;
          }
        } catch (e) {
          // ignore if file doesn't exist yet
        }

        const putBody: any = {
          message: commitMessage || `Sync real app data, code, and app icons (${new Date().toISOString()})`,
          content: Buffer.from(item.content).toString('base64'),
          branch
        };
        if (sha) putBody.sha = sha;

        const putRes = await fetch(fileUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'aistudio-build'
          },
          body: JSON.stringify(putBody)
        });

        if (putRes.ok) {
          pushedFiles.push(item.path);
        } else {
          const errText = await putRes.text();
          console.warn(`Failed pushing ${item.path} to GitHub:`, errText);
        }
      }

      res.json({
        success: true,
        message: `Successfully synced ${pushedFiles.length} files (including real app data, icons, and codebase) to GitHub repo ${repoOwner}/${repoName}!`,
        pushedFiles
      });
    } catch (err: any) {
      console.error("GitHub Sync API error:", err);
      res.status(500).json({ error: err.message || "Failed to sync real app data to GitHub" });
    }
  });

  // The real Service Worker is compiled and served dynamically via Vite or as static assets from /dist in prod.

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files with proper cache headers: no-cache for index.html, eternal cache for hashed chunks
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        } else {
          res.set("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));

    app.get("*all", (req, res) => {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Port ${PORT} is already in use. Retrying in 1s...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, "0.0.0.0");
      }, 1000);
    } else {
      console.error("Server listen error:", err);
    }
  });

  const shutdown = () => {
    console.log("Shutting down server...");
    server.close(() => {
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
});

startServer().catch((err) => {
  console.error("Critical server failure:", err);
});
