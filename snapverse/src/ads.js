import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";

// Ad data model:
// ads collection:
// - id: string
// - title: string
// - description: string
// - imageUrl: string
// - targetUrl: string
// - advertiserId: string
// - status: 'active' | 'paused' | 'completed'
// - budget: number (in cents)
// - spent: number (in cents)
// - targeting: {
//   - ageRange: { min: number, max: number }
//   - interests: string[]
//   - locations: string[]
//   - gender?: 'male' | 'female' | 'all'
// }
// - schedule: {
//   - startDate: timestamp
//   - endDate: timestamp
// }
// - createdAt: timestamp
// - updatedAt: timestamp

// ad_impressions collection:
// - id: string
// - adId: string
// - userId: string
// - timestamp: timestamp
// - device: string
// - location: string

// ad_clicks collection:
// - id: string
// - adId: string
// - userId: string
// - impressionId: string
// - timestamp: timestamp
// - device: string

const ADS_PER_FEED = 3; // Inject 3 ads per feed
const AD_FREQUENCY = 5; // Show ad every 5 posts

/**
 * Get active ads for a user based on targeting
 */
export async function getTargetedAds(db, user) {
  try {
    const now = new Date();
    const adsRef = collection(db, "ads");
    
    const q = query(
      adsRef,
      where("status", "==", "active"),
      where("schedule.startDate", "<=", now),
      where("schedule.endDate", ">=", now),
      orderBy("schedule.startDate", "desc")
    );
    
    const snapshot = await getDocs(q);
    const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter by targeting rules
    return ads.filter(ad => {
      if (!ad.targeting) return true;
      
      // Check age if provided
      if (ad.targeting.ageRange && user.age) {
        if (user.age < ad.targeting.ageRange.min || user.age > ad.targeting.ageRange.max) {
          return false;
        }
      }
      
      // Check gender if provided
      if (ad.targeting.gender && ad.targeting.gender !== 'all' && user.gender) {
        if (user.gender !== ad.targeting.gender) {
          return false;
        }
      }
      
      // Check location if provided
      if (ad.targeting.locations && ad.targeting.locations.length > 0 && user.location) {
        if (!ad.targeting.locations.includes(user.location)) {
          return false;
        }
      }
      
      return true;
    });
  } catch (error) {
    const code = error?.code;
    if (code === 'failed-precondition' && error?.message?.includes('index')) {
      return [];
    }
    if (code === 'permission-denied' || code === 'unauthenticated') {
      return [];
    }
    return [];
  }
}

/**
 * Track ad impression
 */
export async function trackAdImpression(db, adId, userId) {
  if (!adId) {
    console.warn('Cannot track impression: adId is empty');
    return;
  }
  
  try {
    const impressionsRef = collection(db, "ad_impressions");
    
    await addDoc(impressionsRef, {
      adId,
      userId,
      timestamp: serverTimestamp(),
      device: navigator.userAgent,
      location: navigator.language,
    });
    
    // Update ad impression count
    const adRef = doc(db, "ads", adId);
    await updateDoc(adRef, {
      impressions: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error tracking ad impression:', error);
  }
}

/**
 * Track ad click
 */
export async function trackAdClick(db, adId, userId, impressionId) {
  if (!adId) {
    console.warn('Cannot track click: adId is empty');
    return;
  }
  
  try {
    const clicksRef = collection(db, "ad_clicks");
    
    await addDoc(clicksRef, {
      adId,
      userId,
      impressionId,
      timestamp: serverTimestamp(),
      device: navigator.userAgent,
    });
    
    // Update ad click count
    const adRef = doc(db, "ads", adId);
    await updateDoc(adRef, {
      clicks: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error tracking ad click:', error);
  }
}

/**
 * Inject ads into feed posts
 */
export function injectAdsIntoFeed(posts, ads) {
  if (!ads || ads.length === 0) return posts;
  
  const result = [];
  let adIndex = 0;
  let postCount = 0;
  
  for (const post of posts) {
    result.push(post);
    postCount++;
    
    // Inject ad after every AD_FREQUENCY posts
    if (postCount % AD_FREQUENCY === 0 && adIndex < ads.length) {
      result.push({
        type: 'ad',
        ...ads[adIndex],
      });
      adIndex++;
      
      // Cycle through ads if we run out
      if (adIndex >= ads.length) {
        adIndex = 0;
      }
    }
  }
  
  return result;
}

/**
 * Render ad card
 */
export function renderAdCard(ad, db, userId) {
  const card = document.createElement('div');
  card.className = 'bg-white dark:bg-dark-surface rounded-2xl p-4 shadow-soft border border-gray-200 dark:border-dark-border';
  card.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs font-semibold text-accent uppercase tracking-wide">Sponsored</span>
      <span class="text-xs text-gray-500 dark:text-gray-400">${ad.title}</span>
    </div>
    <a href="${ad.targetUrl}" target="_blank" rel="noopener noreferrer" class="block">
      <img src="${ad.imageUrl}" alt="${ad.title}" class="w-full h-48 object-cover rounded-xl mb-3" />
    </a>
    <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">${ad.description}</p>
    <a href="${ad.targetUrl}" target="_blank" rel="noopener noreferrer" 
       class="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-purple-600 text-white font-semibold text-sm hover:from-accentHover hover:to-purple-700 transition-all">
      Learn More
    </a>
  `;
  
  // Track impression when ad is visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        trackAdImpression(db, ad.id, userId);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  observer.observe(card);
  
  // Track clicks
  const link = card.querySelector('a');
  link.addEventListener('click', async () => {
    await trackAdClick(db, ad.id, userId);
  });
  
  return card;
}

/**
 * Create a new ad (for advertisers)
 */
export async function createAd(db, adData) {
  const adsRef = collection(db, "ads");
  
  const newAd = {
    ...adData,
    status: 'active',
    impressions: 0,
    clicks: 0,
    spent: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(adsRef, newAd);
  return docRef.id;
}

/**
 * Get ad analytics for advertiser
 */
export async function getAdAnalytics(db, advertiserId) {
  const adsRef = collection(db, "ads");
  const q = query(adsRef, where("advertiserId", "==", advertiserId));
  
  const snapshot = await getDocs(q);
  const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Calculate totals
  const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
  const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
  const totalSpent = ads.reduce((sum, ad) => sum + (ad.spent || 0), 0);
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
  
  return {
    ads,
    totalImpressions,
    totalClicks,
    totalSpent,
    ctr,
  };
}
