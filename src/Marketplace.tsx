import { useState, useEffect, useRef, ChangeEvent, MouseEvent } from 'react';
import { ArrowLeft, Search, Coins, Sparkles, Flame, ChevronRight, Star, Plus, ShieldCheck, MessageCircle, AlertTriangle, Image as ImageIcon, Camera, X, CheckSquare, Square, Store, Trash2, Edit3, Settings, TrendingUp, Package, Video, Send, CreditCard, Heart, BarChart3, ChevronLeft, FileText, Upload, ShoppingCart, Share2, ThumbsUp, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PostStore } from './lib/PostStore';
import { MarketplaceStore, MarketplaceItem } from './lib/MarketplaceStore';
import { db } from './firebase';
import { collection, query, where, onSnapshot, setDoc, deleteDoc, doc } from 'firebase/firestore';

// Live Categories & Real Products
const CATEGORIES = [
  'All', 
  'Realty',
  'Electronics', 
  'Digital Assets', 
  'Services', 
  'Software',
  'Fashion',
  'Health & Beauty',
  'Web Design',
  'Home Office'
];

import { uploadToCloudinary } from './lib/cloudinary';
import StickerDownloadTool from './components/StickerDownloadTool';
import UserPostsView from './UserPostsView';
import MediaUploadTool from './components/MediaUploadTool';
import UserAvatar from './components/UserAvatar';
import { PayPalCheckoutModal } from './components/PayPalCheckoutModal';
import { CaptureOrderResponse } from './services/paypalService';

export default function Marketplace({ 
  onBack,
  currentUserId = '',
  currentUserName = 'User',
  profileImg = ''
}: { 
  onBack: () => void;
  currentUserId?: string;
  currentUserName?: string;
  profileImg?: string;
}) {
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('yolanda_balance');
    return saved ? parseInt(saved) : 1000; // Provide 1000 initial coins if new user to allow shopping!
  });

  const [allProducts, setAllProducts] = useState<any[]>(() => MarketplaceStore.getProducts());
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsub = MarketplaceStore.subscribe(() => {
      setAllProducts(MarketplaceStore.getProducts());
    });
    return () => unsub();
  }, []);

  const handleDeepScan = async () => {
    setIsScanning(true);
    setScanStatus("Scanning cloud market items...");
    try {
      const res = await MarketplaceStore.performDeepScan();
      setScanStatus(`Deep scan complete! ${res.totalCount} active items synchronized.`);
      setTimeout(() => setScanStatus(null), 4000);
    } catch (e) {
      setScanStatus("Deep scan complete.");
      setTimeout(() => setScanStatus(null), 3000);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('yolanda_balance', balance.toString());
  }, [balance]);

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Cart State
  const [cart, setCart] = useState<any[]>(() => {
    const saved = localStorage.getItem('yolanda_marketplace_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('yolanda_marketplace_cart', JSON.stringify(cart));
  }, [cart]);

  // Review states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  // Upload by URL or File options
  const [mediaUploadType, setMediaUploadType] = useState<'file' | 'url'>('file');
  const [mediaUrls, setMediaUrls] = useState({
    image1: '',
    image2: '',
    image3: '',
    video1: ''
  });

  const [editMediaUploadType, setEditMediaUploadType] = useState<'file' | 'url'>('file');
  const [editMediaUrls, setEditMediaUrls] = useState({
    image1: '',
    image2: '',
    image3: '',
    video1: ''
  });

  // Edit State (Can edit cart item or marketplace listing)
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isEditingCart, setIsEditingCart] = useState<boolean>(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'Select',
    price: ''
  });
  const [editFiles, setEditFiles] = useState<{
     image1: File | null;
     image2: File | null;
     image3: File | null;
     video1: File | null;
  }>({
     image1: null, image2: null, image3: null, video1: null
  });
  const [editPreviews, setEditPreviews] = useState<{
     image1: string | null;
     image2: string | null;
     image3: string | null;
     video1: string | null;
  }>({
     image1: null, image2: null, image3: null, video1: null
  });

  const editImage1Ref = useRef<HTMLInputElement>(null);
  const editImage2Ref = useRef<HTMLInputElement>(null);
  const editImage3Ref = useRef<HTMLInputElement>(null);
  const editVideoRef = useRef<HTMLInputElement>(null);

  const handleCartEditMediaUpload = (type: keyof typeof editPreviews, e: ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        setEditPreviews(prev => ({ ...prev, [type]: url }));
        setEditFiles(prev => ({ ...prev, [type]: file }));
     }
  };

  const handleAddToCart = (item: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isAlreadyInCart = cart.some(c => c.id === item.id || c.originalItemId === item.id);
    if (isAlreadyInCart) {
      alert("This item is already in your cart!");
      return;
    }
    const cartItem = {
      ...item,
      cartId: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      originalItemId: item.id
    };
    setCart(prev => [...prev, cartItem]);
    alert("🛒 Added to cart! Click the 'My Cart' tab or the link banner to view/edit your cart.");
  };

  const handleRemoveFromCart = (cartId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const handleShareCartItemToHomeFeed = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const mediaUrl = item.media && item.media[0] ? item.media[0].url : 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?q=80&w=600&auto=format&fit=crop';
      const mediaType = item.media && item.media[0] && item.media[0].type === 'video' ? 'video' : 'image';
      
      const priceVal = getDiscountedPrice(item.price);
      const payload = {
        userId: currentUserId,
        user: {
          name: currentUserName,
          avatar: profileImg || 'https://www.w3schools.com/howto/img_avatar.png',
          location: 'Marketplace',
          isVerified: true
        },
        image: mediaUrl,
        mediaType: mediaType,
        caption: `🛒 Shared from my cart: "${item.title}" by ${item.seller?.name || 'Yolanda Store'} for only ${priceVal} Coins! Category: ${item.type}.`,
      };
      
      await PostStore.addPost(payload as any);
      alert("🎉 Successfully shared Cart item to Home Feed!");
    } catch (err: any) {
      console.error("Error sharing cart item:", err);
      alert("Failed to share cart item: " + err.message);
    }
  };

  const startEditingItem = (item: any, isCart: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // Add ownership check for cart editing
    if (isCart && item.seller?.id !== currentUserId) {
      alert("❌ You can only edit cart items that you own/listed yourself!");
      return;
    }

    setEditingItem(item);
    setIsEditingCart(isCart);
    setEditForm({
      title: item.title,
      description: item.description || '',
      category: item.type || 'Select',
      price: item.price.toString()
    });

    const img1 = item.media?.[0]?.type === 'image' ? item.media[0].url : null;
    const img2 = item.media?.[1]?.type === 'image' ? item.media[1].url : null;
    const img3 = item.media?.[2]?.type === 'image' ? item.media[2].url : null;
    const vid1 = item.media?.find((m: any) => m.type === 'video')?.url || null;

    setEditPreviews({
      image1: img1,
      image2: img2,
      image3: img3,
      video1: vid1
    });
    setEditFiles({
      image1: null,
      image2: null,
      image3: null,
      video1: null
    });
    setEditMediaUrls({
      image1: img1 || '',
      image2: img2 || '',
      image3: img3 || '',
      video1: vid1 || ''
    });
    setEditMediaUploadType(img1 && !img1.startsWith('blob:') ? 'url' : 'file');
  };

  const saveEditedItemChanges = async () => {
    if (!editForm.title || !editForm.price || editForm.category === 'Select') {
      alert('Please fill in all required fields.');
      return;
    }

    const priceNum = parseInt(editForm.price) || 0;

    // BLOCK USE OF DEFAULT MEDIA: user must have at least one custom image/video
    const hasAnyMedia = editPreviews.image1 || editPreviews.image2 || editPreviews.image3 || editPreviews.video1 || editMediaUrls.image1 || editMediaUrls.image2 || editMediaUrls.image3 || editMediaUrls.video1;
    if (!hasAnyMedia) {
      alert("❌ Save blocked: You must upload at least one image or video. Use of default media placeholders is strictly prohibited!");
      return;
    }

    const targetId = isEditingCart ? editingItem.cartId : editingItem.id;
    
    // Construct default/interim media array based on previews or editMediaUrls
    const updatedMedia: any[] = [];
    if (editPreviews.image1) updatedMedia.push({ type: 'image', url: editPreviews.image1 });
    else if (editMediaUrls.image1) updatedMedia.push({ type: 'image', url: editMediaUrls.image1 });

    if (editPreviews.image2) updatedMedia.push({ type: 'image', url: editPreviews.image2 });
    else if (editMediaUrls.image2) updatedMedia.push({ type: 'image', url: editMediaUrls.image2 });

    if (editPreviews.image3) updatedMedia.push({ type: 'image', url: editPreviews.image3 });
    else if (editMediaUrls.image3) updatedMedia.push({ type: 'image', url: editMediaUrls.image3 });

    if (editPreviews.video1) updatedMedia.push({ type: 'video', url: editPreviews.video1 });
    else if (editMediaUrls.video1) updatedMedia.push({ type: 'video', url: editMediaUrls.video1 });

    if (isEditingCart) {
      // Update in Cart
      setCart(prev => prev.map(item => {
        if (item.cartId === targetId) {
          return {
            ...item,
            title: editForm.title,
            description: editForm.description,
            type: editForm.category,
            price: priceNum,
            media: updatedMedia
          };
        }
        return item;
      }));
    } else {
      // Update in Marketplace products list & Firestore
      MarketplaceStore.updateProduct(targetId, {
        title: editForm.title,
        description: editForm.description,
        type: editForm.category,
        price: priceNum,
        media: updatedMedia
      });
    }

    alert("Changes saved successfully (previews updated automatically)!");
    setEditingItem(null);

    // Background upload of newly selected files to Cloudinary
    const mediaTypes: (keyof typeof editFiles)[] = ['image1', 'image2', 'image3', 'video1'];
    try {
      const finalMedia: any[] = [];
      for (const mType of mediaTypes) {
        const file = editFiles[mType];
        if (file) {
          const type = mType === 'video1' ? 'video' : 'image';
          const res = await uploadToCloudinary(file, type);
          if (res) {
            finalMedia.push({ type, url: res.secure_url });
          }
        } else {
          const existingUrl = editPreviews[mType] || editMediaUrls[mType];
          if (existingUrl && !existingUrl.startsWith('blob:')) {
            const type = mType === 'video1' ? 'video' : 'image';
            finalMedia.push({ type, url: existingUrl });
          }
        }
      }

      if (finalMedia.length > 0) {
        if (isEditingCart) {
          setCart(prev => prev.map(item => {
            if (item.cartId === targetId) {
              return { ...item, media: finalMedia };
            }
            return item;
          }));
        } else {
          MarketplaceStore.updateProduct(targetId, { media: finalMedia });
        }
      }
    } catch (err) {
      console.error("Background re-upload failed:", err);
    }
  };

  const handleAddReview = (text: string, rating: number) => {
    if (!selectedItem) return;
    const newReview = {
      id: `rev_${Date.now()}`,
      userName: currentUserName,
      userAvatar: profileImg || undefined,
      rating,
      text,
      timestamp: Date.now()
    };

    const updatedReviews = [newReview, ...(selectedItem.reviews || [
      {
        id: "rev1",
        userName: "Alex Rivers",
        rating: 5,
        text: "Great product! Exactly as described. Used it right away.",
        image: "https://picsum.photos/seed/productpic/200/200",
        timestamp: Date.now() - 86400000 * 2
      },
      {
        id: "rev2",
        userName: "Sarah Jenkins",
        rating: 4,
        text: "Very good quality, arrived quickly. Extremely satisfied with this purchase.",
        timestamp: Date.now() - 86400000 * 5
      }
    ])];

    const totalRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0);
    const avgRating = parseFloat((totalRating / updatedReviews.length).toFixed(1));

    const updatedProducts = allProducts.map((p: any) => {
      if (p.id === selectedItem.id) {
        const updatedSeller = p.seller ? {
          ...p.seller,
          rating: avgRating,
          reviewsCount: updatedReviews.length
        } : {
          rating: avgRating,
          reviewsCount: updatedReviews.length
        };
        return {
          ...p,
          reviews: updatedReviews,
          seller: updatedSeller
        };
      }
      return p;
    });

    setAllProducts(updatedProducts);
    setSelectedItem((prev: any) => {
      if (!prev) return null;
      const updatedSeller = prev.seller ? {
        ...prev.seller,
        rating: avgRating,
        reviewsCount: updatedReviews.length
      } : {
        rating: avgRating,
        reviewsCount: updatedReviews.length
      };
      return {
        ...prev,
        reviews: updatedReviews,
        seller: updatedSeller
      };
    });
  };

  useEffect(() => {
    if (mediaUploadType === 'url') {
      setMediaPreview({
        image1: mediaUrls.image1 || null,
        image2: mediaUrls.image2 || null,
        image3: mediaUrls.image3 || null,
        video1: mediaUrls.video1 || null
      });
    }
  }, [mediaUrls, mediaUploadType]);

  useEffect(() => {
    if (editMediaUploadType === 'url') {
      setEditPreviews({
        image1: editMediaUrls.image1 || null,
        image2: editMediaUrls.image2 || null,
        image3: editMediaUrls.image3 || null,
        video1: editMediaUrls.video1 || null
      });
    }
  }, [editMediaUrls, editMediaUploadType]);
  
  // Sell Media State
  const image1Ref = useRef<HTMLInputElement>(null);
  const image2Ref = useRef<HTMLInputElement>(null);
  const image3Ref = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  
  const [mediaFiles, setMediaFiles] = useState<{
     image1: File | null;
     image2: File | null;
     image3: File | null;
     video1: File | null;
  }>({
     image1: null, image2: null, image3: null, video1: null
  });

  const [mediaPreview, setMediaPreview] = useState<{
     image1: string | null;
     image2: string | null;
     image3: string | null;
     video1: string | null;
  }>({
     image1: null, image2: null, image3: null, video1: null
  });

  const [sellForm, setSellForm] = useState({
    title: '',
    description: '',
    category: 'Select',
    price: ''
  });

  const handleMediaUpload = (type: keyof typeof mediaPreview, e: ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        setMediaPreview(prev => ({ ...prev, [type]: url }));
        setMediaFiles(prev => ({ ...prev, [type]: file }));
     }
  };

  const handleShareListing = async () => {
    if (!sellForm.title || !sellForm.price || sellForm.category === 'Select') {
      alert('Please fill in all required fields.');
      return;
    }

    // BLOCK USE OF DEFAULT MEDIA: user must have at least one custom image/video (either uploaded file or pasted URL)
    const hasMedia = mediaFiles.image1 || mediaFiles.image2 || mediaFiles.image3 || mediaFiles.video1 || mediaUrls.image1 || mediaUrls.image2 || mediaUrls.image3 || mediaUrls.video1;
    if (!hasMedia) {
      alert("❌ Publish blocked: You must upload at least one custom image or video (via local file or URL option). Use of default media placeholders is strictly prohibited!");
      return;
    }

    // setIsUploading(true);
    try {
      const media: any[] = [];
      
      // Upload all selected files to Cloudinary in background
      const uploadPromises = [];
      const mediaTypes: (keyof typeof mediaFiles)[] = ['image1', 'image2', 'image3', 'video1'];
      
      const newItemId = `u_${Date.now()}`;
      
      // Construct starting media based on user's selected file previews or text URLs
      const initialMedia: any[] = [];
      if (mediaPreview.image1) initialMedia.push({ type: 'image', url: mediaPreview.image1 });
      else if (mediaUrls.image1) initialMedia.push({ type: 'image', url: mediaUrls.image1 });

      if (mediaPreview.image2) initialMedia.push({ type: 'image', url: mediaPreview.image2 });
      else if (mediaUrls.image2) initialMedia.push({ type: 'image', url: mediaUrls.image2 });

      if (mediaPreview.image3) initialMedia.push({ type: 'image', url: mediaPreview.image3 });
      else if (mediaUrls.image3) initialMedia.push({ type: 'image', url: mediaUrls.image3 });

      if (mediaPreview.video1) initialMedia.push({ type: 'video', url: mediaPreview.video1 });
      else if (mediaUrls.video1) initialMedia.push({ type: 'video', url: mediaUrls.video1 });

      // Save to MarketplaceStore & Firestore
      const newItem = {
        title: sellForm.title,
        description: sellForm.description,
        type: sellForm.category,
        price: parseInt(sellForm.price) || 0,
        icon: '📦',
        media: initialMedia,
        isUserAdded: true,
        seller: {
          id: currentUserId || 'anon',
          name: currentUserName || 'User',
          avatar: profileImg || undefined,
          rating: 5.0,
          reviewsCount: 0
        }
      };
      
      const createdId = await MarketplaceStore.addProduct(newItem);
      setView('home');

      // Heavy lifting in background
      (async () => {
        try {
          for (const mType of mediaTypes) {
            const file = mediaFiles[mType];
            if (file) {
              const type = mType === 'video1' ? 'video' : 'image';
              const res = await uploadToCloudinary(file, type);
              if (res) media.push({ type, url: res.secure_url });
            } else if (mediaUrls[mType as keyof typeof mediaUrls]) {
              const type = mType === 'video1' ? 'video' : 'image';
              media.push({ type, url: mediaUrls[mType as keyof typeof mediaUrls] });
            }
          }
          
          // Update the item with final media in MarketplaceStore
          if (media.length > 0) {
            await MarketplaceStore.updateProduct(createdId, { media, isPending: false });
          }
        } catch (err) {
          console.error("Listing background upload failed:", err);
        }
      })();

      // Reset form immediately
      setSellForm({ title: '', description: '', category: 'Select', price: '' });
      setMediaPreview({ image1: null, image2: null, image3: null, video1: null });
      setMediaFiles({ image1: null, image2: null, image3: null, video1: null });
      setMediaUrls({ image1: '', image2: '', image3: '', video1: '' });
    } catch (err) {
      console.error("Listing initiation failed:", err);
    } finally {
      // setIsUploading(false);
    }
  };
  
  // View Routing State
  const [view, setView] = useState<'home' | 'sell' | 'item_detail' | 'success' | 'policy' | 'seller_dashboard' | 'favorites' | 'seller_profile' | 'all_listings' | 'stickers' | 'user_posts' | 'media_upload' | 'cart'>('home');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Real-time review likes state
  const [reviewLikes, setReviewLikes] = useState<{ [reviewId: string]: string[] }>({});

  useEffect(() => {
    if (!selectedItem?.id) {
      setReviewLikes({});
      return;
    }

    const likesQuery = query(
      collection(db, 'review_likes'),
      where('productId', '==', selectedItem.id)
    );

    const unsubscribe = onSnapshot(likesQuery, (snapshot: any) => {
      const likesMap: { [reviewId: string]: string[] } = {};
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        const { reviewId, userId } = data;
        if (reviewId && userId) {
          if (!likesMap[reviewId]) {
            likesMap[reviewId] = [];
          }
          if (!likesMap[reviewId].includes(userId)) {
            likesMap[reviewId].push(userId);
          }
        }
      });
      setReviewLikes(likesMap);
    }, (error: any) => {
      console.error("Error fetching review likes:", error);
    });

    return () => unsubscribe();
  }, [selectedItem?.id]);

  const handleToggleLikeReview = async (reviewId: string) => {
    if (!currentUserId) {
      alert("Please sign in or use a valid user profile to like reviews.");
      return;
    }
    if (!selectedItem?.id) return;

    const likeDocId = `${selectedItem.id}_${reviewId}_${currentUserId}`;
    const rLikes = reviewLikes[reviewId] || [];
    const hasLiked = rLikes.includes(currentUserId);

    try {
      if (hasLiked) {
        await deleteDoc(doc(db, 'review_likes', likeDocId));
      } else {
        await setDoc(doc(db, 'review_likes', likeDocId), {
          userId: currentUserId,
          productId: selectedItem.id,
          reviewId: reviewId,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error("Error toggling like on review:", error);
    }
  };
  
  // Media & Purchase Flow State
  const [fullscreenMedia, setFullscreenMedia] = useState<{url: string, type: string} | null>(null);
  const [showPurchaseAgreement, setShowPurchaseAgreement] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet'|'card'|'paypal'>('paypal');

  // PayPal Checkout State
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [payPalParams, setPayPalParams] = useState<{
    amount: number;
    description: string;
    itemType: 'marketplace_item' | 'marketplace_cart';
    itemId?: string;
  } | null>(null);
  const [lastPaymentDetails, setLastPaymentDetails] = useState<{
    method: string;
    orderId?: string;
    captureId?: string;
    amount: number;
    currency?: string;
    payerEmail?: string;
    itemTitle?: string;
  } | null>(null);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{sender: 'me' | 'seller', text: string}[]>([
    { sender: 'seller', text: 'Hi! Let me know if you have any questions about this item.' }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const toggleFavorite = (id: string, e?: MouseEvent) => {
    e?.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  // Discount Calculation
  const getDiscountedPrice = (price: number) => {
     if (price === 0) return 0;
     // Apply dynamic 10% discount and round correctly
     return Math.max(1, Math.floor(price * 0.90));
  };

  const executePurchase = () => {
    if (!selectedItem) return;
    const finalPrice = getDiscountedPrice(selectedItem.price);
    
    if (paymentMethod === 'paypal') {
      setPayPalParams({
        amount: finalPrice,
        description: `Marketplace Purchase: ${selectedItem.title}`,
        itemType: 'marketplace_item',
        itemId: selectedItem.id
      });
      setShowPayPalModal(true);
    } else if (paymentMethod === 'wallet') {
      if (balance >= finalPrice) {
        setBalance(b => b - finalPrice);
        setShowPurchaseAgreement(false);
        setAgreedToTerms(false);
        setLastPaymentDetails({
          method: 'Wallet Balance',
          amount: finalPrice,
          currency: 'COINS',
          itemTitle: selectedItem.title
        });
        setView('success');
      } else {
        alert('Not enough coins in wallet. Please pay with PayPal or top up your balance.');
      }
    } else {
      // Card simulation fallback
      setShowPurchaseAgreement(false);
      setAgreedToTerms(false);
      setLastPaymentDetails({
        method: 'Credit Card',
        amount: finalPrice,
        currency: 'USD',
        itemTitle: selectedItem.title
      });
      setView('success');
    }
  };

  const handlePayPalSuccess = (captureRes: CaptureOrderResponse) => {
    setShowPayPalModal(false);
    setShowPurchaseAgreement(false);
    setAgreedToTerms(false);

    const isCart = payPalParams?.itemType === 'marketplace_cart';
    const purchasedTitle = isCart ? `Cart Checkout (${cart.length} items)` : (selectedItem?.title || 'Marketplace Item');

    setLastPaymentDetails({
      method: 'PayPal',
      orderId: captureRes.orderId,
      captureId: captureRes.captureId,
      amount: captureRes.paidAmount,
      currency: captureRes.currency || 'USD',
      payerEmail: captureRes.payer?.email,
      itemTitle: purchasedTitle
    });

    if (isCart) {
      setCart([]);
    }
    setView('success');
  };

  const handleBuy = (item: any) => {
    if (item.price === 0) {
      alert(`Successfully installed ${item.title}!`);
      return;
    }
    setSelectedItem(item);
    setShowPurchaseAgreement(true);
  };

  // 1. Success Screen Sub-Component
  const renderSuccess = () => {
    const isPayPal = lastPaymentDetails?.method === 'PayPal';
    const finalPrice = lastPaymentDetails ? lastPaymentDetails.amount : (selectedItem ? getDiscountedPrice(selectedItem.price) : 0);
    const itemTitle = lastPaymentDetails?.itemTitle || selectedItem?.title || 'Purchased Item';

    return (
    <div className="flex flex-col h-full bg-white absolute inset-0 z-50 overflow-hidden items-center justify-center p-6 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 shadow-sm ${
        isPayPal ? 'bg-blue-50 text-[#003087] border-4 border-blue-100' : 'bg-green-100 text-green-500'
      }`}>
        {isPayPal ? (
          <span className="text-3xl font-black italic">P</span>
        ) : (
          <Star className="w-10 h-10 fill-green-500" />
        )}
      </motion.div>

      <div className="flex items-center gap-1.5 justify-center mb-1">
        {isPayPal && (
          <span className="bg-[#003087] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            PayPal Verified
          </span>
        )}
      </div>

      <h2 className="text-2xl font-black text-gray-900 mb-2">
        {isPayPal ? 'PayPal Payment Successful!' : 'Payment Successful!'}
      </h2>
      <p className="text-gray-500 mb-6 max-w-[280px] text-xs leading-relaxed">
        Your payment for <span className="font-bold text-gray-900">{itemTitle}</span> was processed and verified securely.
      </p>
      
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 w-full max-w-[340px] mb-6 text-left space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-500">Amount Paid</span>
          <span className="font-black text-base text-gray-900 flex items-center gap-1">
            {isPayPal ? `$${finalPrice.toFixed(2)} USD` : <><Coins className="w-4 h-4 text-yellow-500" /> {finalPrice}</>}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-500">Payment Gateway</span>
          <span className="font-bold text-gray-900">{lastPaymentDetails?.method || 'Direct'}</span>
        </div>

        {lastPaymentDetails?.captureId && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 font-mono text-[11px]">
            <span className="font-medium text-gray-400">PayPal Capture ID</span>
            <span className="font-bold text-gray-700 truncate max-w-[150px]">{lastPaymentDetails.captureId}</span>
          </div>
        )}

        {lastPaymentDetails?.payerEmail && (
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="font-medium text-gray-400">PayPal Payer</span>
            <span className="font-bold text-gray-700 truncate max-w-[160px]">{lastPaymentDetails.payerEmail}</span>
          </div>
        )}
      </div>

      <button 
        onClick={() => {
          setLastPaymentDetails(null);
          setView('home');
        }} 
        className="bg-brand-blue text-white font-bold w-full max-w-[340px] py-3.5 rounded-xl active:scale-95 transition-transform shadow-lg shadow-blue-500/20 cursor-pointer"
      >
        Return to Marketplace
      </button>
    </div>
  )};

  // 2. Sell Item Sub-Component (Instagram Style)
  const renderSellItem = () => {
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
          <button onClick={() => setView('home')} className="text-gray-600 font-medium active:scale-95 transition-transform text-sm">Cancel</button>
          <h1 className="text-base font-bold text-gray-900">New Listing</h1>
          <button 
            onClick={handleShareListing} 
            className="text-brand-blue font-bold active:scale-95 transition-transform text-sm"
          >
            Share
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto pb-20">
           {/* Media upload grid */}
           <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Media (Max 10MB each)</span>
                 <div className="flex bg-gray-100 rounded-lg p-0.5 text-[10px]">
                    <button
                       type="button"
                       onClick={() => setMediaUploadType('file')}
                       className={`px-2.5 py-1 rounded-md font-bold transition-all ${mediaUploadType === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                       📁 File Upload
                    </button>
                    <button
                       type="button"
                       onClick={() => setMediaUploadType('url')}
                       className={`px-2.5 py-1 rounded-md font-bold transition-all ${mediaUploadType === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                       🔗 URL Option
                    </button>
                 </div>
              </div>

              {mediaUploadType === 'url' && (
                 <div className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-100 mb-3.5 text-left">
                    <div>
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Image 1 URL</label>
                       <input
                          type="url"
                          placeholder="https://example.com/image1.jpg"
                          value={mediaUrls.image1}
                          onChange={e => setMediaUrls(prev => ({ ...prev, image1: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Image 2 URL (Optional)</label>
                       <input
                          type="url"
                          placeholder="https://example.com/image2.jpg"
                          value={mediaUrls.image2}
                          onChange={e => setMediaUrls(prev => ({ ...prev, image2: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Image 3 URL (Optional)</label>
                       <input
                          type="url"
                          placeholder="https://example.com/image3.jpg"
                          value={mediaUrls.image3}
                          onChange={e => setMediaUrls(prev => ({ ...prev, image3: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Video 1 URL (Optional)</label>
                       <input
                          type="url"
                          placeholder="https://example.com/video1.mp4"
                          value={mediaUrls.video1}
                          onChange={e => setMediaUrls(prev => ({ ...prev, video1: e.target.value }))}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                       />
                    </div>
                 </div>
              )}
              
              {/* Hidden Inputs */}
              <input type="file" accept="image/*" className="hidden" ref={image1Ref} onChange={(e) => handleMediaUpload('image1', e)} />
              <input type="file" accept="image/*" className="hidden" ref={image2Ref} onChange={(e) => handleMediaUpload('image2', e)} />
              <input type="file" accept="image/*" className="hidden" ref={image3Ref} onChange={(e) => handleMediaUpload('image3', e)} />
              <input type="file" accept="video/*" className="hidden" ref={videoRef} onChange={(e) => handleMediaUpload('video1', e)} />

              <div className="grid grid-cols-4 gap-2">
                 <div 
                    onClick={() => mediaUploadType === 'file' && image1Ref.current?.click()} 
                    className={`aspect-square bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 overflow-hidden relative ${mediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                 >
                    {mediaPreview.image1 ? <img src={mediaPreview.image1} className="w-full h-full object-cover" /> : <><Camera className="w-6 h-6 mb-1 text-gray-500" /><span className="text-[10px] font-bold">Image 1</span></>}
                 </div>
                 <div 
                    onClick={() => mediaUploadType === 'file' && image2Ref.current?.click()} 
                    className={`aspect-square bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 overflow-hidden relative ${mediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                 >
                    {mediaPreview.image2 ? <img src={mediaPreview.image2} className="w-full h-full object-cover" /> : <><ImageIcon className="w-5 h-5 mb-1" /><span className="text-[10px]">Image 2</span></>}
                 </div>
                 <div 
                    onClick={() => mediaUploadType === 'file' && image3Ref.current?.click()} 
                    className={`aspect-square bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 overflow-hidden relative ${mediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                 >
                    {mediaPreview.image3 ? <img src={mediaPreview.image3} className="w-full h-full object-cover" /> : <><ImageIcon className="w-5 h-5 mb-1" /><span className="text-[10px]">Image 3</span></>}
                 </div>
                 <div 
                    onClick={() => mediaUploadType === 'file' && videoRef.current?.click()} 
                    className={`aspect-square bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 overflow-hidden relative ${mediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                 >
                    {mediaPreview.video1 ? <video src={mediaPreview.video1} className="w-full h-full object-cover" /> : <><div className="w-5 h-5 mb-1 rounded flex items-center justify-center border-2 border-current"><div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-current border-b-[3px] border-b-transparent ml-0.5"></div></div><span className="text-[10px]">Video 1</span></>}
                 </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Upload up to 3 pictures and 1 video clip.</p>
           </div>
           
           <div className="w-full h-2 bg-gray-50 border-y border-gray-100"></div>
           
           <div className="flex flex-col">
             <input 
                type="text" 
                placeholder="What are you selling?" 
                value={sellForm.title}
                onChange={e => setSellForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-4 outline-none text-base font-semibold border-b border-gray-100 placeholder-gray-400" 
              />
             <textarea 
                placeholder="Write a detailed description..." 
                rows={4} 
                value={sellForm.description}
                onChange={e => setSellForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 outline-none text-sm resize-none border-b border-gray-100 placeholder-gray-400"
              ></textarea>
             
             <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-gray-900 font-semibold text-sm">Category</span>
                <select 
                  value={sellForm.category}
                  onChange={e => setSellForm(prev => ({ ...prev, category: e.target.value }))}
                  className="bg-transparent text-gray-500 text-sm outline-none text-right appearance-none" dir="rtl"
                >
                   <option>Select</option>
                   {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
             </div>
             
             <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-gray-900 font-semibold text-sm">Price (Coins)</span>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={sellForm.price}
                  onChange={e => setSellForm(prev => ({ ...prev, price: e.target.value }))}
                  className="text-right outline-none text-brand-blue font-bold w-32" 
                />
             </div>
           </div>
        </div>
      </div>
    );
  };

  // 3. Consumer Policy Sub-Component
  const renderPolicy = () => (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <header className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-20">
        <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Consumer Protection</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
         <ShieldCheck className="w-16 h-16 text-green-500 mb-4" />
         <h2 className="text-2xl font-black mb-2 text-center">Buyer Safety First</h2>
         <p className="text-gray-500 text-center mb-6 leading-relaxed text-sm">
           Every transaction on our Marketplace is secured and monitored for quality assurance.
         </p>
         <div className="bg-gray-50 p-4 rounded-2xl w-full flex flex-col gap-3">
            <h3 className="font-bold text-gray-900 mb-1">Our Guarantees:</h3>
            <ul className="text-sm text-gray-600 flex flex-col gap-2 list-disc pl-4">
              <li>100% Refund within 24h if the item doesn't work.</li>
              <li>Secure escrow system for coin transfers.</li>
              <li>All sellers undergo verification before listing.</li>
              <li>Report abuse feature actively monitored by AI.</li>
            </ul>
         </div>
      </div>
    </div>
  );

  // 4. Item Detail Sub-Component (Instagram Style UI)
  const renderItemDetail = () => {
    if (!selectedItem) return null;
    
    // Dynamic 10% Discount logic for the item details overlay
    const finalPrice = getDiscountedPrice(selectedItem.price);
    const hasDiscount = selectedItem.price > 0 && finalPrice < selectedItem.price;

    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
          <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
             <button
               onClick={(e) => toggleFavorite(selectedItem?.id, e)}
               className={`p-2 rounded-full active:scale-90 transition-all ${favorites.includes(selectedItem?.id) ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:bg-gray-100'}`}
             >
               <Heart className={`w-5 h-5 ${favorites.includes(selectedItem?.id) ? 'fill-red-500' : ''}`} />
             </button>
             <button onClick={() => alert('Item Reported to Safety Team for review.')} className="text-red-500 font-semibold active:scale-95 transition-transform text-xs flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Report</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-24">
           {/* Seller Uploaded Media Horizontal Scroll */}
           <div className="w-full bg-gray-50 border-b border-gray-100 flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
              {selectedItem.media?.length > 0 ? (
                selectedItem.media.map((mediaObj: any, idx: number) => (
                  <div key={idx} onClick={() => setFullscreenMedia(mediaObj)} className="w-full aspect-square shrink-0 snap-center relative cursor-pointer group">
                     {mediaObj.type === 'video' ? (
                       <div className="w-full h-full bg-black flex items-center justify-center relative">
                         <video src={mediaObj.url} className="w-full h-full object-cover opacity-80" muted loop autoPlay playsInline />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                              <Video className="w-8 h-8 text-white ml-1" />
                            </div>
                         </div>
                       </div>
                     ) : (
                       <img src={mediaObj.url} className="w-full h-full object-cover" />
                     )}
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        {mediaObj.type !== 'video' && <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity" />}
                     </div>
                  </div>
                ))
              ) : (
                <div className="w-full aspect-square flex items-center justify-center text-[100px] shrink-0">
                  {selectedItem.icon}
                </div>
              )}
           </div>

           <div className="p-4">
              {hasDiscount && (
                 <div className="mb-3 inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 shadow-sm">
                    <Flame className="w-4 h-4 fill-current" />
                    <span className="text-xs font-bold uppercase tracking-wider">Limited Offer: 10% Off</span>
                 </div>
              )}
              <div className="flex justify-between items-start mb-2">
                 <h1 className="text-2xl font-black text-gray-900 leading-tight pr-2">{selectedItem.title}</h1>
                 <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={(e) => handleAddToCart(selectedItem, e)} 
                      className="bg-blue-50 text-brand-blue px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 transition-transform border border-blue-100 hover:bg-blue-100"
                      title="Add to shopping cart"
                    >
                       <ShoppingCart className="w-4 h-4" /> Add
                    </button>
                    <button onClick={() => document.getElementById('buy-portal')?.scrollIntoView({ behavior: 'smooth' })} className="bg-brand-blue text-white px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 transition-transform shadow-md hover:bg-blue-600">
                       Buy <Coins className="w-3.5 h-3.5" /> {finalPrice}
                    </button>
                 </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-1 rounded-sm">{selectedItem.type}</span>
                 {hasDiscount && (
                    <span className="text-sm font-semibold text-gray-400 line-through decoration-red-400 opacity-70 flex items-center gap-1">
                       {selectedItem.price} <Coins className="w-3 h-3 grayscale" />
                    </span>
                 )}
              </div>
              
              <p className="mt-4 text-sm text-gray-600 leading-relaxed font-medium">
                {selectedItem.description || "This is a premium listing on our marketplace. The seller guarantees high quality and provides dedicated support for this product. 100% money-back guarantee."}
              </p>

              {/* Seller Info & Contact */}
              <div 
                onClick={() => setView('seller_profile')}
                className="mt-6 flex items-center justify-between p-3 border border-gray-100 rounded-2xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                 <div className="flex items-center gap-3">
                     <UserAvatar src={selectedItem.seller?.avatar || undefined} name={selectedItem.seller?.name || "TechStore"} size="md" />
                    <div className="flex flex-col">
                       <span className="font-bold text-gray-900 text-sm">{selectedItem.seller?.name || "TechStore Pro"}</span>
                       <span className="text-xs text-gray-500 flex items-center gap-0.5"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {selectedItem.seller?.rating || 4.9} ({selectedItem.seller?.reviewsCount !== undefined ? selectedItem.seller.reviewsCount : 128} reviews)</span>
                    </div>
                 </div>
                 <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>

              {/* Reviews Section */}
              <div className="mt-8 border-t border-gray-100 pt-6">
                 <h3 className="font-bold text-lg text-gray-900 mb-4 flex justify-between items-center">
                    Reviews
                    <button 
                       onClick={() => {
                          setReviewText('');
                          setReviewRating(5);
                          setShowReviewModal(true);
                       }} 
                       className="text-brand-blue text-sm font-semibold active:opacity-80"
                    >
                       Write Review
                    </button>
                 </h3>
                 
                 <div className="flex flex-col gap-4">
                    {(selectedItem.reviews || [
                      {
                        id: "rev1",
                        userName: "Alex Rivers",
                        rating: 5,
                        text: "Great product! Exactly as described. Used it right away.",
                        image: "https://picsum.photos/seed/productpic/200/200",
                        timestamp: Date.now() - 86400000 * 2
                      },
                      {
                        id: "rev2",
                        userName: "Sarah Jenkins",
                        rating: 4,
                        text: "Very good quality, arrived quickly. Extremely satisfied with this purchase.",
                        timestamp: Date.now() - 86400000 * 5
                      }
                    ]).map((r: any) => {
                      const rLikes = reviewLikes[r.id] || [];
                      const hasLiked = currentUserId ? rLikes.includes(currentUserId) : false;
                      const likesCount = rLikes.length;
                      
                      return (
                        <div key={r.id} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 text-left">
                           <UserAvatar src={r.userAvatar} name={r.userName} size="sm" />
                           <div className="flex flex-col flex-1">
                              <div className="flex items-center justify-between">
                                 <span className="font-bold text-sm text-gray-900">{r.userName}</span>
                                 <button
                                   onClick={() => handleToggleLikeReview(r.id)}
                                   className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border shrink-0 ${
                                     hasLiked
                                       ? 'bg-blue-50 text-brand-blue border-blue-200 shadow-sm'
                                       : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50 hover:text-gray-600'
                                   }`}
                                 >
                                   <ThumbsUp className={`w-3 h-3 ${hasLiked ? 'fill-current' : ''}`} />
                                   <span>{likesCount > 0 ? likesCount : 'Like'}</span>
                                 </button>
                              </div>
                              <div className="flex text-yellow-500 my-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star 
                                     key={i} 
                                     className={`w-3 h-3 ${i < r.rating ? 'fill-current' : 'text-gray-200'}`} 
                                  />
                                ))}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{r.text}</p>
                              {r.image && (
                                <img src={r.image} className="w-24 h-24 object-cover rounded-lg mt-2 shadow-sm" />
                              )}
                           </div>
                        </div>
                      );
                    })}
                 </div>
              </div>
              
              {/* Purchase Action Fixed Bottom Portal */}
              <div id="buy-portal" className="mt-8 border-t border-gray-100 pt-6 flex flex-col gap-3">
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-brand-blue shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                       <span className="font-bold text-gray-900 text-sm">Protected Transaction</span>
                       <span className="text-xs text-gray-600 mt-1">Review the media carefully. Digital and software goods are strictly No Refund per our Consumer Policy.</span>
                    </div>
                 </div>
                 <button onClick={() => handleBuy(selectedItem)} className="w-full bg-brand-blue text-white py-3.5 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2">
                    Proceed to Purchase <Coins className="w-5 h-5 text-yellow-300" /> {finalPrice}
                 </button>
              </div>
           </div>
        </div>
      </div>
    );
  };

  // 5. Favorites Sub-Component
  const renderFavorites = () => {
    const favoriteItems = allProducts.filter((item: any) => favorites.includes(item.id));
    
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
          <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Favorites</h1>
          <div className="w-10"></div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 content-start">
          {favoriteItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
               <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Heart className="w-10 h-10 text-gray-300" />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-1">No favorites yet</h3>
               <p className="text-gray-500 text-sm">Items you love will appear here for easy access later.</p>
               <button onClick={() => setView('home')} className="mt-6 text-brand-blue font-bold px-6 py-2 bg-blue-50 rounded-full active:scale-95 transition-all">Go Shopping</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               {favoriteItems.map((item, i) => (
                 <motion.div 
                   key={item.id}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.05 }}
                   onClick={() => { setSelectedItem(item); setView('item_detail'); }}
                   className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative group"
                 >
                   <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                     {item.media && item.media[0] ? (
                       <img src={item.media[0].url} className="w-full h-full object-cover" alt={item.title} />
                     ) : (
                       <span className="text-4xl">{item.icon}</span>
                     )}
                     <button 
                       onClick={(e) => toggleFavorite(item.id, e)}
                       className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform z-10"
                     >
                       <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                     </button>
                   </div>
                   <div className="p-3 flex flex-col gap-1">
                     <span className="font-bold text-gray-900 text-sm truncate">{item.title}</span>
                     <div className="flex justify-between items-center mt-1">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.type}</span>
                        <div className="flex items-center gap-0.5 text-xs font-black text-brand-blue">
                           <Coins className="w-3 h-3 text-yellow-500" /> {item.price}
                        </div>
                     </div>
                   </div>
                 </motion.div>
               ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 7. Generic Seller Profile Sub-Component
  const renderSellerProfile = () => {
    const isUserSeller = selectedItem?.seller?.id === currentUserId;
    const sellerName = selectedItem?.seller?.name || "TechStore Pro";
    const sellerAvatar = selectedItem?.seller?.avatar || undefined;
    const rating = selectedItem?.seller?.rating || 4.9;
    const reviewsCount = selectedItem?.seller?.reviewsCount !== undefined ? selectedItem?.seller.reviewsCount : 128;
    const sellerDesc = isUserSeller 
      ? `Official profile of ${sellerName}. Welcome to my listings! Contact me for any questions or support regarding these items.`
      : `Official account of ${sellerName}. 24/7 support guaranteed.`;
    
    const sellerItems = allProducts.filter((p: any) => p.seller?.id === selectedItem?.seller?.id || (!p.seller && !isUserSeller)).slice(0, 3);
    
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
          <button onClick={() => setView('item_detail')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-bold text-gray-900">Seller Profile</h1>
          <button onClick={() => alert('Seller Reported.')} className="p-2 -mr-2 rounded-full text-red-500 active:scale-95">
            <AlertTriangle className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-20">
           {/* Profile Card */}
           <div className="p-6 flex flex-col items-center border-b border-gray-50">
              <UserAvatar 
                 src={sellerAvatar} 
                 name={sellerName}
                 size="xl"
                 className="shadow-xl mb-4"
              />
              <h2 className="text-2xl font-black text-gray-900">{sellerName}</h2>
              <div className="flex items-center gap-2 mt-1">
                 <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                 <span className="font-bold text-gray-900">{rating}</span>
                 <span className="text-gray-400 text-sm">({reviewsCount} reviews)</span>
              </div>
              <p className="mt-4 text-center text-sm text-gray-600 max-w-xs">
                 {sellerDesc}
              </p>
              
              <div className="flex gap-3 mt-6 w-full px-4 justify-center">
                 <button onClick={() => setShowChat(true)} className="w-full max-w-[200px] py-3 bg-brand-blue text-white font-bold rounded-xl active:scale-95 shadow-lg shadow-blue-500/20">Message</button>
              </div>
           </div>

           {/* Stats */}
           <div className="flex justify-around py-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-col items-center">
                 <span className="text-xl font-bold text-gray-900">4.9/5</span>
                 <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Rating</span>
              </div>
              <div className="flex flex-col items-center">
                 <span className="text-xl font-bold text-gray-900">856</span>
                 <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sales</span>
              </div>
              <div className="flex flex-col items-center">
                 <span className="text-xl font-bold text-gray-900">32</span>
                 <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Items</span>
              </div>
           </div>

           {/* Listings */}
           <div className="p-4">
              <h3 className="font-bold text-gray-900 mb-4 uppercase text-xs tracking-widest">Seller Listings</h3>
              <div className="grid grid-cols-2 gap-3">
                 {sellerItems.map(item => (
                   <div key={item.id} onClick={() => { setSelectedItem(item); setView('item_detail'); }} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-95 transition-transform">
                      <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        {item.media?.[0] ? <img src={item.media[0].url} className="w-full h-full object-cover" /> : <span>{item.icon}</span>}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                        <p className="text-[10px] text-brand-blue font-bold mt-0.5">{item.price} coins</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  };

  // 9. All Listings Sub-Component
  const renderAllListings = () => {
    const filtered = allProducts.filter((item: any) => 
      (activeCategory === 'All' || item.type === activeCategory) &&
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">All Listings</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 font-bold text-gray-900 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100">
               <Coins className="w-4 h-4 text-yellow-500" />
               {balance}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
           {/* Search & Category inline */}
           <div className="flex flex-col gap-3 mb-6">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search listings..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium outline-none"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`py-1.5 px-4 rounded-full text-xs font-bold transition-colors shrink-0 ${activeCategory === cat ? 'bg-brand-blue text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              {filtered.map((item: any, i: number) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => { setSelectedItem(item); setView('item_detail'); }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative group"
                >
                  <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                    {item.media && item.media[0] ? (
                      <img src={item.media[0].url} className="w-full h-full object-cover" alt={item.title} />
                    ) : (
                      <span className="text-4xl">{item.icon}</span>
                    )}
                    <button 
                      onClick={(e) => toggleFavorite(item.id, e)}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform z-10 border border-gray-100"
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    <span className="font-bold text-gray-900 text-sm truncate">{item.title}</span>
                    <div className="flex justify-between items-center mt-1">
                       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.type}</span>
                       <div className="flex items-center gap-0.5 text-xs font-black text-brand-blue">
                          <Coins className="w-3 h-3 text-yellow-500" /> {item.price}
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))}
           </div>
        </div>
      </div>
    );
  };

  const renderHome = () => {
    
    // Filtering logic
    const filteredTrending = allProducts.slice(0, 4).filter((item: any) => 
      (activeCategory === 'All' || item.type === activeCategory) &&
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredExclusive = allProducts.slice(4).filter((item: any) => 
      (activeCategory === 'All' || item.type === activeCategory) &&
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex flex-col gap-3 sticky top-0 z-20 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Store</h1>
              <button onClick={() => setView('policy')} className="text-[10px] text-gray-500 hover:text-brand-blue flex items-center gap-0.5"><ShieldCheck className="w-3 h-3" /> Consumer Policy</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
               onClick={handleDeepScan}
               disabled={isScanning}
               className={`p-2 rounded-full active:scale-95 transition-colors ${isScanning ? 'bg-blue-50 text-blue-600 animate-spin' : 'text-gray-600 hover:bg-gray-100'}`}
               title="Deep Scan Market"
            >
               <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setIsSearching(!isSearching)} className={`p-2 rounded-full active:scale-95 transition-colors ${isSearching ? 'bg-blue-100 text-brand-blue' : 'text-gray-600 hover:bg-gray-100'}`}>
               <Search className="w-5 h-5" />
            </button>
            <button
               onClick={() => setView('favorites')}
               className={`p-2 rounded-full active:scale-95 transition-colors ${view === 'favorites' ? 'bg-red-50 text-red-500' : 'text-gray-600 hover:bg-gray-100'} relative`}
            >
               <Heart className={`w-5 h-5 ${favorites.length > 0 ? 'fill-red-500 text-red-500' : ''}`} />
               {favorites.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full border border-white"></span>}
            </button>
            <button
               onClick={() => setView('cart')}
               className={`p-2 rounded-full active:scale-95 transition-colors ${view === 'cart' ? 'bg-blue-100 text-brand-blue' : 'text-gray-600 hover:bg-gray-100'} relative`}
               title="My Cart"
            >
               <ShoppingCart className="w-5 h-5" />
               {cart.length > 0 && (
                 <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full border border-white flex items-center justify-center px-1">
                   {cart.length}
                 </span>
               )}
            </button>
            <button
               onClick={() => setView('stickers')}
               className={`p-2 rounded-full active:scale-95 transition-colors ${view === 'stickers' ? 'bg-blue-100 text-brand-blue' : 'text-gray-600 hover:bg-gray-100'} relative`}
               title="Sticker Importer"
            >
               <Package className="w-5 h-5" />
            </button>
            <button
               onClick={() => setView('user_posts')}
               className={`p-2 rounded-full active:scale-95 transition-colors ${view === 'user_posts' ? 'bg-blue-100 text-brand-blue' : 'text-gray-600 hover:bg-gray-100'} relative`}
               title="User Posts API"
            >
               <FileText className="w-5 h-5" />
            </button>
            <button
               onClick={() => setView('media_upload')}
               className={`p-2 rounded-full active:scale-95 transition-colors ${view === 'media_upload' ? 'bg-blue-100 text-brand-blue' : 'text-gray-600 hover:bg-gray-100'} relative`}
               title="Auto-Upload & Preview"
            >
               <Upload className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1 font-bold text-gray-900 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100">
               <Coins className="w-4 h-4 text-yellow-500" />
               {balance}
            </div>
          </div>
        </div>
        
        {/* Buy / Sell Navigation */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
           <button 
             onClick={() => setView('home')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${view === 'home' || view === 'item_detail' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
           >
             <Package className="w-4 h-4" /> Shop
           </button>
           <button 
             onClick={() => setView('cart')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${view === 'cart' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
           >
             <ShoppingCart className="w-4 h-4" /> Cart
             {cart.length > 0 && (
               <span className="bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full">
                 {cart.length}
               </span>
             )}
           </button>
           <button 
             onClick={() => setView('seller_dashboard')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${view === 'seller_dashboard' || view === 'sell' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
           >
             <Store className="w-4 h-4" /> Selling
           </button>
        </div>

        {/* Deep Scan Status Banner */}
        {scanStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between shadow-xs mt-1 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-600 ${isScanning ? 'animate-spin' : ''}`} />
              <p className="text-xs font-bold text-blue-900">{scanStatus}</p>
            </div>
            {isScanning && (
              <span className="text-[10px] bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded-full animate-pulse">Syncing...</span>
            )}
          </div>
        )}

        {/* Edit Your Cart Banner Alert */}
        {cart.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between shadow-xs mt-1">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-brand-blue animate-pulse" />
              <div>
                <p className="text-xs font-bold text-gray-900">You have {cart.length} item{cart.length > 1 ? 's' : ''} in your cart!</p>
                <p className="text-[10px] text-gray-500 font-medium">Re-upload media or edit details before checkout.</p>
              </div>
            </div>
            <button 
              onClick={() => setView('cart')}
              className="bg-brand-blue text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all shadow-sm"
            >
              Edit Your Cart
            </button>
          </div>
        )}

        {/* Search Bar */}
        <motion.div 
           initial={false}
           animate={{ height: isSearching ? 'auto' : 0, opacity: isSearching ? 1 : 0 }}
           className="overflow-hidden"
        >
           <div className="relative pb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input 
                 type="text" 
                 placeholder="Search by name or description..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-gray-100 rounded-xl py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium"
              />
           </div>
        </motion.div>
      </header>

      {/* Categories Tab Bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex overflow-x-auto gap-2 no-scrollbar sticky z-10 transition-all duration-300">
        {CATEGORIES.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`py-1.5 px-4 rounded-full text-sm font-semibold transition-colors shrink-0 ${activeCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 no-scrollbar relative">
         {/* Floating Action Button for Selling */}
         <button 
           onClick={() => setView('sell')}
           className="absolute bottom-6 right-6 w-14 h-14 bg-brand-blue text-white rounded-full shadow-2xl flex flex-col items-center justify-center active:scale-95 hover:bg-blue-600 transition-all z-30 border-4 border-white"
           title="Sell an Item"
         >
           <Plus className="w-6 h-6" />
           <span className="text-[9px] font-black uppercase tracking-tighter">Sell</span>
         </button>

         {/* Trending Section - Grid */}
         <div className="px-4 mt-6">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-lg text-gray-900 flex items-center gap-1.5"><Flame className="w-5 h-5 text-red-500" /> Trending Now</h3>
               <button onClick={() => setView('all_listings')} className="text-brand-blue font-semibold text-sm flex items-center hover:underline active:opacity-75">See All <ChevronRight className="w-4 h-4 ml-0.5" /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {filteredTrending.map((item, i) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 + 0.2 }}
                  onClick={() => { setSelectedItem(item); setView('item_detail'); }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative group"
                >
                  <div className="w-full aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden relative">
                    {item.media && item.media[0] ? (
                      <img src={item.media[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.title} />
                    ) : (
                      <span className="text-4xl">{item.icon}</span>
                    )}
                    <button 
                      onClick={(e) => toggleFavorite(item.id, e)}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform z-10 border border-gray-100"
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    <span className="font-bold text-gray-900 text-sm truncate">{item.title}</span>
                    <div className="flex justify-between items-center mt-1">
                       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.type}</span>
                       <div className="flex items-center gap-0.5 text-xs font-black text-brand-blue">
                          <Coins className="w-3 h-3 text-yellow-500" /> {item.price}
                       </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
         </div>

         {/* Exclusive deals */}
         <div className="px-4 mt-10 mb-8">
            <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-1.5"><Sparkles className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Exclusive Deals</h3>
            <div className="flex flex-col gap-3">
              {filteredExclusive.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden group" onClick={() => { setSelectedItem(item); setView('item_detail'); }}>
                   <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      {item.media && item.media[0] ? (
                        <img src={item.media[0].url} className="w-full h-full object-cover" alt={item.title} />
                      ) : (
                        <span className="text-2xl">{item.icon}</span>
                      )}
                   </div>
                   <div className="flex-1 flex flex-col justify-center min-w-0">
                      <span className="font-bold text-gray-900 text-[15px] leading-tight truncate">{item.title}</span>
                      <span className="text-xs text-gray-500 mt-0.5 font-medium truncate">{item.type}</span>
                   </div>
                   <div className="flex flex-col items-end gap-2 pr-2">
                       <button
                         onClick={(e) => toggleFavorite(item.id, e)}
                         className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center active:scale-90 transition-transform"
                       >
                         <Heart className={`w-4 h-4 ${favorites.includes(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                       </button>
                       <div className="px-3 py-1 bg-brand-blue text-white text-[11px] font-black rounded-full flex items-center gap-1 shrink-0">
                         <Coins className="w-3 h-3 text-yellow-300" />
                         {item.price}
                       </div>
                   </div>
                </div>
              ))}
            </div>
         </div>
      </div>
    </div>
  );
  };

  // 11. Seller Dashboard Sub-Component
  const renderSellerDashboard = () => {
    // Filter listings added by current user
    const myListings = allProducts.filter((p: any) => p.isUserAdded || p.seller?.id === currentUserId);

    return (
      <div className="flex flex-col h-full bg-white">
        <header className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <button onClick={() => setView('home')} className="p-2 hover:bg-gray-100 rounded-full active:scale-95"><ChevronLeft className="w-6 h-6"/></button>
          <h1 className="font-bold text-lg">Seller Dashboard</h1>
          <button 
            onClick={() => setView('sell')} 
            className="px-3.5 py-1.5 bg-brand-blue text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Stats Panel */}
          <div className="grid grid-cols-3 gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 p-4 rounded-2xl text-white shadow-md">
            <div className="text-center">
              <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Your Listings</p>
              <p className="text-lg font-black mt-1">{myListings.length}</p>
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Total Sales</p>
              <p className="text-lg font-black mt-1">12</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Earned Coins</p>
              <p className="text-lg font-black mt-1 flex items-center justify-center gap-0.5"><Coins className="w-3.5 h-3.5 text-yellow-300" /> 420</p>
            </div>
          </div>

          <div className="px-1 pt-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Manage Your Active Listings</h3>
            
            {myListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                <Store className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-700">No active listings yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px]">Publish items or custom services and see them listed here!</p>
                <button 
                  onClick={() => setView('sell')} 
                  className="mt-4 bg-blue-50 text-brand-blue font-bold text-xs px-4 py-2 rounded-xl hover:bg-blue-100 transition-all"
                >
                  Create First Listing
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map((item, idx) => (
                  <div key={item.id || idx} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex gap-4 items-center relative">
                    {/* Media Thumbnail */}
                    <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-50 shrink-0">
                      {item.media && item.media[0] ? (
                        item.media[0].type === 'video' ? (
                          <video src={item.media[0].url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={item.media[0].url} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <span className="text-2xl">{item.icon || '📦'}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="text-[9px] font-bold uppercase text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.type}
                      </span>
                      <h4 className="font-bold text-sm text-gray-900 mt-1 truncate">{item.title}</h4>
                      <p className="text-xs text-brand-blue font-bold flex items-center gap-0.5 mt-1">
                        <Coins className="w-3 h-3 text-yellow-500" /> {item.price} coins
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => startEditingItem(item, false, e)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-brand-blue rounded-xl active:scale-95 transition-all"
                        title="Edit Listing Details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this listing from the store?")) {
                            MarketplaceStore.deleteProduct(item.id);
                          }
                        }}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl active:scale-95 transition-all"
                        title="Delete Listing"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 12. Cart Sub-Component with re-upload media & editing tools
  const renderCart = () => {
    const totalCoins = cart.reduce((sum, item) => sum + getDiscountedPrice(item.price), 0);
    const canAfford = balance >= totalCoins;

    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('home')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-700">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">My Cart</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 font-bold text-gray-900 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100">
               <Coins className="w-4 h-4 text-yellow-500" />
               {balance}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[55vh] text-center p-6">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Your cart is empty</h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Explore our marketplace and add some exciting services, assets, or software templates to your cart!
              </p>
              <button 
                onClick={() => setView('home')} 
                className="mt-6 bg-brand-blue text-white font-bold px-6 py-2.5 rounded-xl active:scale-95 transition-all shadow-md"
              >
                Go Shopping
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{cart.length} ITEMS SELECTED</span>
                <button 
                  onClick={() => { if(confirm("Are you sure you want to clear your cart?")) setCart([]); }}
                  className="text-xs font-semibold text-red-500 hover:underline"
                >
                  Clear All
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {cart.map((item, idx) => {
                  const discountedPrice = getDiscountedPrice(item.price);
                  return (
                    <motion.div 
                      key={item.cartId || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex gap-4 items-center group relative"
                    >
                      {/* Media Display */}
                      <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-gray-100">
                        {item.media && item.media[0] ? (
                          item.media[0].type === 'video' ? (
                            <video src={item.media[0].url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={item.media[0].url} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <span className="text-3xl">{item.icon || '📦'}</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-brand-blue bg-blue-50 px-2 py-0.5 rounded">
                            {item.type}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mt-1 truncate">{item.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">Seller: {item.seller?.name || 'Yolanda Store'}</p>
                        
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="font-black text-brand-blue text-sm flex items-center gap-0.5">
                            <Coins className="w-3.5 h-3.5 text-yellow-500" /> {discountedPrice}
                          </span>
                          {item.price > discountedPrice && (
                            <span className="text-[10px] text-gray-400 line-through">
                              {item.price}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <button 
                          onClick={(e) => handleShareCartItemToHomeFeed(item, e)}
                          className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl active:scale-95 transition-all flex items-center gap-1 text-xs font-bold"
                          title="Share to Home Feed"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Share</span>
                        </button>
                        <button 
                          onClick={(e) => startEditingItem(item, true, e)}
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-brand-blue rounded-xl active:scale-95 transition-all flex items-center gap-1 text-xs font-bold"
                          title="Edit Cart Listing Details & Media"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button 
                          onClick={(e) => handleRemoveFromCart(item.cartId, e)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl active:scale-95 transition-all"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Summary Checkout Card */}
              <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5 space-y-4">
                <h3 className="font-bold text-gray-900 text-base">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Items Total</span>
                    <span>{cart.length} items</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Platform Discount (10% Off)</span>
                    <span className="text-green-500">Active</span>
                  </div>
                  <div className="h-[1px] bg-gray-200" />
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold text-gray-900">Total Due</span>
                    <div className="text-right">
                      <span className="font-black text-lg text-brand-blue flex items-center justify-end gap-1">
                        <Coins className="w-4 h-4 text-yellow-500" /> {totalCoins} coins
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 block">
                        or ${totalCoins}.00 USD
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  {/* PayPal Cart Checkout */}
                  <button 
                    onClick={() => {
                      setPayPalParams({
                        amount: totalCoins,
                        description: `IMChat Cart Checkout (${cart.length} items)`,
                        itemType: 'marketplace_cart'
                      });
                      setShowPayPalModal(true);
                    }}
                    className="w-full py-3.5 rounded-2xl font-black text-white shadow-lg bg-[#0070BA] hover:bg-[#003087] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-blue-500/20"
                  >
                    <div className="w-5 h-5 rounded-full bg-white text-[#003087] flex items-center justify-center font-black italic text-xs">P</div>
                    <span>Checkout with PayPal (${totalCoins}.00 USD)</span>
                  </button>

                  {/* Wallet Balance Checkout */}
                  <button 
                    onClick={() => {
                      if (!canAfford) {
                        alert("❌ Insufficient funds: You don't have enough coins in your wallet. Use PayPal for instant checkout.");
                        return;
                      }
                      setBalance((b: number) => b - totalCoins);
                      setCart([]);
                      setLastPaymentDetails({
                        method: 'Wallet Balance',
                        amount: totalCoins,
                        currency: 'COINS',
                        itemTitle: `Cart Checkout (${cart.length} items)`
                      });
                      setView('success');
                    }}
                    className={`w-full py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                      canAfford 
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 active:scale-98 cursor-pointer' 
                        : 'bg-gray-100/60 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Pay with Wallet Coins ({totalCoins})</span>
                    <Coins className="w-4 h-4 text-yellow-500" />
                  </button>

                  {!canAfford && (
                    <p className="text-center text-[11px] text-gray-500 font-medium">
                      Wallet has {balance} coins. You can checkout directly using PayPal above.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 absolute inset-0 z-50 overflow-hidden">
      {view === 'all_listings' && renderAllListings()}
      {view === 'home' && renderHome()}
      {view === 'cart' && renderCart()}
      {view === 'seller_profile' && renderSellerProfile()}
      {view === 'seller_dashboard' && renderSellerDashboard()}
      {view === 'favorites' && renderFavorites()}
      {view === 'sell' && renderSellItem()}
      {view === 'policy' && renderPolicy()}
      {view === 'item_detail' && renderItemDetail()}
      {view === 'success' && renderSuccess()}
      {view === 'user_posts' && (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col">
          <UserPostsView onBack={() => setView('home')} />
        </div>
      )}
      {view === 'media_upload' && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <MediaUploadTool onClose={() => setView('home')} />
        </div>
      )}
      {view === 'stickers' && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
           <StickerDownloadTool onClose={() => setView('home')} />
        </div>
      )}
      
      {/* Modals & Overlays */}
      <AnimatePresence>
        {fullscreenMedia && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] bg-black flex flex-col"
          >
             <header className="px-4 py-4 flex justify-end">
                <button onClick={() => setFullscreenMedia(null)} className="p-2 bg-white/10 rounded-full active:scale-95"><X className="w-6 h-6 text-white" /></button>
             </header>
             <div className="flex-1 overflow-hidden relative flex items-center justify-center pb-8">
                {fullscreenMedia.type === 'video' ? (
                  <video src={fullscreenMedia.url} className="w-full max-h-full object-contain" controls autoPlay playsInline />
                ) : (
                  <img src={fullscreenMedia.url} className="w-full h-full object-contain" />
                )}
             </div>
          </motion.div>
        )}

        {showPurchaseAgreement && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
             <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
             >
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle className="w-6 h-6" /></div>
                <h2 className="text-xl font-black text-gray-900 mb-2">Purchase Agreement</h2>
                
                {/* Embedded Media Review */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-900 mb-2">Review Seller Media:</p>
                  <div className="w-full flex gap-2 overflow-x-auto no-scrollbar pb-1">
                     {selectedItem?.media?.length > 0 ? (
                       selectedItem.media.map((mediaObj: any, idx: number) => (
                         <div key={idx} onClick={() => setFullscreenMedia(mediaObj)} className="w-16 h-16 shrink-0 rounded-lg overflow-hidden relative cursor-pointer group border border-gray-100 shadow-sm active:scale-95 transition-transform">
                            {mediaObj.type === 'video' ? (
                              <div className="w-full h-full bg-black relative">
                                <video src={mediaObj.url} className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-6 h-6 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                                    <Video className="w-3 h-3 text-white ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img src={mediaObj.url} className="w-full h-full object-cover" />
                            )}
                         </div>
                       ))
                     ) : (
                       <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">
                         {selectedItem?.icon}
                       </div>
                     )}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 max-h-[150px] overflow-y-auto">
                   <p className="text-xs text-gray-600 leading-relaxed font-medium">
                     By proceeding, you agree to buy <span className="font-bold text-gray-900">{selectedItem?.title}</span> from the seller. 
                     <br/><br/>
                     <strong className="text-gray-900">Refund Policy:</strong>
                     <br/>
                     Tangible goods may be disputed within 24 hours if defective. 
                     <span className="text-red-500 font-bold"> Digital goods, services, web design, and software items are STRICTLY NON-REFUNDABLE</span> once the transaction is finalized. 
                   </p>
                </div>

                {/* Payment Options */}
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-900 mb-2">Payment Method:</p>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setPaymentMethod('wallet')}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${paymentMethod === 'wallet' ? 'border-brand-blue bg-blue-50/50 ring-1 ring-brand-blue/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Coins className={`w-5 h-5 ${paymentMethod === 'wallet' ? 'text-brand-blue' : 'text-gray-400'}`} />
                        <span className="text-sm font-semibold text-gray-900">Wallet Balance</span>
                      </div>
                      <span className="text-xs font-bold text-gray-500">{balance} coins</span>
                    </button>
                    
                    <button 
                      onClick={() => setPaymentMethod('card')}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${paymentMethod === 'card' ? 'border-brand-blue bg-blue-50/50 ring-1 ring-brand-blue/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-brand-blue' : 'text-gray-400'}`} />
                        <span className="text-sm font-semibold text-gray-900">Credit Card</span>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => setPaymentMethod('paypal')}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${paymentMethod === 'paypal' ? 'border-[#0070BA] bg-blue-50/60 ring-2 ring-[#0070BA]/30' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-[#003087] flex items-center justify-center font-black text-white italic text-xs shadow-xs">P</div>
                        <div className="text-left">
                          <span className="text-sm font-bold text-gray-900 block leading-tight">PayPal</span>
                          <span className="text-[10px] text-gray-500 font-medium">PayPal Balance, Debit & Credit Cards</span>
                        </div>
                      </div>
                      <span className="bg-[#003087] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                        Instant
                      </span>
                    </button>
                  </div>
                </div>
                
                <div 
                   onClick={() => setAgreedToTerms(!agreedToTerms)}
                   className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl mb-6 cursor-pointer active:bg-gray-50"
                >
                   {agreedToTerms ? <CheckSquare className="w-5 h-5 text-brand-blue shrink-0" /> : <Square className="w-5 h-5 text-gray-400 shrink-0" />}
                   <span className="text-sm font-semibold text-gray-700 leading-tight">I have reviewed all seller media and agree to the No Refund policy.</span>
                </div>

                <div className="flex gap-3">
                   <button onClick={() => { setShowPurchaseAgreement(false); setAgreedToTerms(false); }} className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl active:scale-95">Cancel</button>
                   <button 
                      onClick={executePurchase}
                      disabled={!agreedToTerms}
                      className={`flex-1 py-3 font-bold text-white rounded-xl active:scale-95 flex justify-center items-center gap-1.5 transition-all cursor-pointer ${
                        !agreedToTerms 
                          ? 'bg-gray-300 cursor-not-allowed' 
                          : paymentMethod === 'paypal'
                            ? 'bg-[#0070BA] hover:bg-[#003087] shadow-lg shadow-blue-500/20'
                            : 'bg-brand-blue shadow-lg shadow-blue-500/20'
                      }`}
                   >
                     {paymentMethod === 'paypal' ? (
                       <>
                         <span className="font-black italic text-xs">P</span>
                         <span>Pay with PayPal ${selectedItem ? getDiscountedPrice(selectedItem.price) : 0}</span>
                       </>
                     ) : paymentMethod === 'wallet' ? (
                       <>
                         <span>Pay</span>
                         <Coins className="w-4 h-4 text-yellow-300" />
                         <span>{selectedItem ? getDiscountedPrice(selectedItem.price) : 0}</span>
                       </>
                     ) : (
                       <span>Pay Now</span>
                     )}
                   </button>
                </div>
             </motion.div>
          </motion.div>
        )}

        {showChat && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="absolute inset-0 z-[110] bg-white flex flex-col"
          >
             <header className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0">
                <div className="flex items-center gap-3">
                   <button onClick={() => setShowChat(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95"><ArrowLeft className="w-6 h-6 text-gray-700" /></button>
                   <div className="flex items-center gap-2">
                       <div className="w-10 h-10 rounded-full bg-[url('https://picsum.photos/seed/seller/50/50')] bg-cover border border-gray-100"></div>
                       <div className="flex flex-col">
                           <span className="font-bold text-gray-900 text-sm leading-tight">TechStore Pro</span>
                           <span className="text-xs text-green-500 font-medium">Online</span>
                       </div>
                   </div>
                </div>
             </header>
             
             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50 pb-8">
               <div className="text-center mb-4">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-200/50 px-2 py-1 rounded-full">Today</span>
               </div>
               {chatMessages.map((msg, idx) => (
                 <div key={idx} className={`max-w-[75%] p-3 rounded-2xl ${msg.sender === 'me' ? 'bg-brand-blue text-white rounded-br-sm self-end shadow-sm' : 'bg-white border border-gray-100 text-gray-900 rounded-bl-sm self-start shadow-sm'}`}>
                   <p className="text-sm leading-relaxed">{msg.text}</p>
                 </div>
               ))}
               {/* Auto-reply simulation filler */}
               {chatMessages[chatMessages.length - 1]?.sender === 'me' && (
                 <div className="max-w-[75%] p-3 rounded-2xl bg-white border border-gray-100 text-gray-400 rounded-bl-sm self-start shadow-sm flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse"></div>
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75"></div>
                   <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150"></div>
                 </div>
               )}
             </div>

             <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2 pb-6">
                <input
                   type="text"
                   value={newMessage}
                   onChange={e => setNewMessage(e.target.value)}
                   placeholder="Message seller..."
                   className="flex-1 bg-gray-100 border border-transparent rounded-full px-5 py-3 text-sm outline-none focus:bg-white focus:border-brand-blue/30 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] transition-all"
                   onKeyDown={e => { 
                     if (e.key === 'Enter' && newMessage.trim()) { 
                       setChatMessages([...chatMessages, { sender: 'me', text: newMessage.trim() }]); 
                       setNewMessage(''); 
                       setTimeout(() => {
                         setChatMessages(prev => [...prev, { sender: 'seller', text: 'Thanks for reaching out! I typically respond within an hour.' }]);
                       }, 1500);
                     } 
                   }}
                />
                <button
                   onClick={() => { 
                     if (newMessage.trim()) { 
                       setChatMessages([...chatMessages, { sender: 'me', text: newMessage.trim() }]); 
                       setNewMessage(''); 
                       setTimeout(() => {
                         setChatMessages(prev => [...prev, { sender: 'seller', text: 'Thanks for reaching out! I typically respond within an hour.' }]);
                       }, 1500);
                     } 
                   }}
                   disabled={!newMessage.trim()}
                   className={`p-3 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${newMessage.trim() ? 'bg-brand-blue text-white shadow-md active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                   <Send className="w-5 h-5 ml-0.5" />
                </button>
             </div>
          </motion.div>
        )}

        {editingItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
             <motion.div 
                initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
                className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
             >
                <header className="bg-white px-5 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20">
                  <button 
                    onClick={() => setEditingItem(null)} 
                    className="text-gray-500 hover:text-gray-700 font-medium text-sm active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <h3 className="text-base font-bold text-gray-950">
                    {isEditingCart ? 'Edit Cart Item' : 'Edit Listing'}
                  </h3>
                  <button 
                    onClick={saveEditedItemChanges} 
                    className="text-brand-blue font-bold text-sm active:scale-95 transition-transform hover:opacity-80"
                  >
                    Save
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                   {/* Media Re-upload Grid */}
                   <div>
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                           Media (re-uploads image/video automatically)
                         </span>
                         <div className="flex bg-gray-100 rounded-lg p-0.5 text-[10px]">
                            <button
                               type="button"
                               onClick={() => setEditMediaUploadType('file')}
                               className={`px-2 py-0.5 rounded-md font-bold transition-all ${editMediaUploadType === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                               File
                            </button>
                            <button
                               type="button"
                               onClick={() => setEditMediaUploadType('url')}
                               className={`px-2 py-0.5 rounded-md font-bold transition-all ${editMediaUploadType === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                               URL
                            </button>
                         </div>
                      </div>

                      {editMediaUploadType === 'url' && (
                         <div className="space-y-2 bg-gray-50 p-3 rounded-2xl border border-gray-100 mb-3.5 text-left">
                            <div>
                               <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Image 1 URL</label>
                               <input
                                  type="url"
                                  placeholder="https://example.com/image1.jpg"
                                  value={editMediaUrls.image1}
                                  onChange={e => setEditMediaUrls(prev => ({ ...prev, image1: e.target.value }))}
                                  className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                               />
                            </div>
                            <div>
                               <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Image 2 URL (Optional)</label>
                               <input
                                  type="url"
                                  placeholder="https://example.com/image2.jpg"
                                  value={editMediaUrls.image2}
                                  onChange={e => setEditMediaUrls(prev => ({ ...prev, image2: e.target.value }))}
                                  className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                               />
                            </div>
                            <div>
                               <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Image 3 URL (Optional)</label>
                               <input
                                  type="url"
                                  placeholder="https://example.com/image3.jpg"
                                  value={editMediaUrls.image3}
                                  onChange={e => setEditMediaUrls(prev => ({ ...prev, image3: e.target.value }))}
                                  className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                               />
                            </div>
                            <div>
                               <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Video 1 URL (Optional)</label>
                               <input
                                  type="url"
                                  placeholder="https://example.com/video1.mp4"
                                  value={editMediaUrls.video1}
                                  onChange={e => setEditMediaUrls(prev => ({ ...prev, video1: e.target.value }))}
                                  className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none text-xs text-gray-800 focus:border-brand-blue"
                               />
                            </div>
                         </div>
                      )}
                      
                      <input type="file" accept="image/*" className="hidden" ref={editImage1Ref} onChange={(e) => handleCartEditMediaUpload('image1', e)} />
                      <input type="file" accept="image/*" className="hidden" ref={editImage2Ref} onChange={(e) => handleCartEditMediaUpload('image2', e)} />
                      <input type="file" accept="image/*" className="hidden" ref={editImage3Ref} onChange={(e) => handleCartEditMediaUpload('image3', e)} />
                      <input type="file" accept="video/*" className="hidden" ref={editVideoRef} onChange={(e) => handleCartEditMediaUpload('video1', e)} />

                      <div className="grid grid-cols-4 gap-2">
                         <div 
                            onClick={() => editMediaUploadType === 'file' && editImage1Ref.current?.click()} 
                            className={`aspect-square bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 overflow-hidden relative group ${editMediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                         >
                            {editPreviews.image1 ? (
                              <>
                                <img src={editPreviews.image1} className="w-full h-full object-cover" />
                                {editMediaUploadType === 'file' && (
                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                     <Camera className="w-5 h-5 text-white" />
                                   </div>
                                )}
                              </>
                            ) : (
                              <><Camera className="w-5 h-5 mb-1 text-gray-400" /><span className="text-[9px] font-bold">Image 1</span></>
                            )}
                         </div>
                         <div 
                            onClick={() => editMediaUploadType === 'file' && editImage2Ref.current?.click()} 
                            className={`aspect-square bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 overflow-hidden relative group ${editMediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                         >
                            {editPreviews.image2 ? (
                              <>
                                <img src={editPreviews.image2} className="w-full h-full object-cover" />
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditPreviews(prev => ({ ...prev, image2: null })); setEditFiles(prev => ({ ...prev, image2: null })); if (editMediaUploadType === 'url') setEditMediaUrls(prev => ({ ...prev, image2: '' })); }}
                                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <><ImageIcon className="w-4 h-4 mb-1" /><span className="text-[9px]">Image 2</span></>
                            )}
                         </div>
                         <div 
                            onClick={() => editMediaUploadType === 'file' && editImage3Ref.current?.click()} 
                            className={`aspect-square bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 overflow-hidden relative group ${editMediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                         >
                            {editPreviews.image3 ? (
                              <>
                                <img src={editPreviews.image3} className="w-full h-full object-cover" />
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditPreviews(prev => ({ ...prev, image3: null })); setEditFiles(prev => ({ ...prev, image3: null })); if (editMediaUploadType === 'url') setEditMediaUrls(prev => ({ ...prev, image3: '' })); }}
                                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <><ImageIcon className="w-4 h-4 mb-1" /><span className="text-[9px]">Image 3</span></>
                            )}
                         </div>
                         <div 
                            onClick={() => editMediaUploadType === 'file' && editVideoRef.current?.click()} 
                            className={`aspect-square bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 overflow-hidden relative group ${editMediaUploadType === 'file' ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                         >
                            {editPreviews.video1 ? (
                              <>
                                <video src={editPreviews.video1} className="w-full h-full object-cover" muted />
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditPreviews(prev => ({ ...prev, video1: null })); setEditFiles(prev => ({ ...prev, video1: null })); if (editMediaUploadType === 'url') setEditMediaUrls(prev => ({ ...prev, video1: '' })); }}
                                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <><Video className="w-4 h-4 mb-1" /><span className="text-[9px]">Video 1</span></>
                            )}
                         </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium">Upload custom pictures/videos. Leave unmodified to retain original media.</p>
                   </div>

                   <div className="space-y-4">
                     <div>
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Item Title</label>
                       <input 
                          type="text" 
                          placeholder="What are you selling?" 
                          value={editForm.title}
                          onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-sm font-semibold focus:border-brand-blue/30 focus:bg-white transition-all placeholder-gray-400" 
                        />
                     </div>

                     <div>
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Description</label>
                       <textarea 
                          placeholder="Write a detailed description..." 
                          rows={3} 
                          value={editForm.description}
                          onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-sm resize-none focus:border-brand-blue/30 focus:bg-white transition-all placeholder-gray-400"
                        ></textarea>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Category</label>
                         <select 
                           value={editForm.category}
                           onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                           className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-sm font-medium focus:border-brand-blue/30 focus:bg-white transition-all text-gray-700"
                         >
                            <option>Select</option>
                            {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                         </select>
                       </div>

                       <div>
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Price (Coins)</label>
                         <input 
                           type="number" 
                           placeholder="0" 
                           value={editForm.price}
                           onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                           className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-sm font-bold text-brand-blue focus:border-brand-blue/30 focus:bg-white transition-all placeholder-gray-400" 
                         />
                       </div>
                     </div>
                   </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                   <button 
                     onClick={() => setEditingItem(null)} 
                     className="flex-1 py-3 font-bold text-sm text-gray-600 bg-gray-200 rounded-xl active:scale-95 transition-all"
                   >
                     Discard Changes
                   </button>
                   <button 
                     onClick={saveEditedItemChanges}
                     className="flex-1 py-3 font-bold text-sm text-white bg-brand-blue rounded-xl active:scale-95 transition-all shadow-md shadow-blue-500/10"
                   >
                     Apply Changes
                   </button>
                </div>
             </motion.div>
          </motion.div>
        )}

        {showReviewModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[160] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
             <motion.div 
                initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
                className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 text-center"
             >
                <h3 className="text-lg font-black text-gray-900 mb-2">Write a Review</h3>
                <p className="text-xs text-gray-500 mb-6">How was your experience with this item?</p>
                
                {/* Rating stars */}
                <div className="flex items-center justify-center gap-2 mb-6">
                   {[1, 2, 3, 4, 5].map((val) => {
                     return (
                       <button
                          key={val}
                          type="button"
                          onClick={() => setReviewRating(val)}
                          className="p-1 active:scale-90 transition-transform focus:outline-none"
                       >
                          <Star 
                             className={`w-8 h-8 transition-colors ${val <= reviewRating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} 
                          />
                       </button>
                     );
                   })}
                </div>
                
                {/* Text input */}
                <textarea
                   placeholder="Write your review here... Be as detailed as possible."
                   rows={4}
                   value={reviewText}
                   onChange={(e) => setReviewText(e.target.value)}
                   className="w-full border border-gray-200 rounded-2xl p-3 text-sm outline-none resize-none focus:border-brand-blue placeholder-gray-400 mb-6 text-left"
                ></textarea>
                
                {/* Actions */}
                <div className="flex gap-3">
                   <button
                      type="button"
                      onClick={() => setShowReviewModal(false)}
                      className="flex-1 py-3 border border-gray-200 text-gray-500 font-bold rounded-xl active:scale-95 transition-transform text-sm"
                   >
                      Cancel
                   </button>
                   <button
                      type="button"
                      disabled={!reviewText.trim()}
                      onClick={() => {
                         handleAddReview(reviewText, reviewRating);
                         setShowReviewModal(false);
                      }}
                      className={`flex-1 py-3 font-bold rounded-xl active:scale-95 transition-transform text-sm text-white flex items-center justify-center gap-1.5 ${reviewText.trim() ? 'bg-brand-blue shadow-lg shadow-blue-500/10' : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                       <Send className="w-4 h-4" /> Send
                    </button>
                 </div>
              </motion.div>
           </motion.div>
         )}
      </AnimatePresence>

      {/* Global PayPal Checkout Modal */}
      {showPayPalModal && payPalParams && (
        <PayPalCheckoutModal
          isOpen={showPayPalModal}
          onClose={() => setShowPayPalModal(false)}
          amount={payPalParams.amount}
          currency="USD"
          description={payPalParams.description}
          itemType={payPalParams.itemType}
          itemId={payPalParams.itemId}
          userId={currentUserId}
          onSuccess={handlePayPalSuccess}
          onError={(err) => alert(`PayPal Checkout Error: ${err}`)}
        />
      )}
    </div>
  );
}
