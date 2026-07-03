import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";

// Subscription data model:
// subscriptions collection:
// - id: string
// - userId: string
// - plan: 'free' | 'premium' | 'creator'
// - status: 'active' | 'canceled' | 'past_due' | 'incomplete'
// - stripeSubscriptionId: string
// - stripeCustomerId: string
// - currentPeriodStart: timestamp
// - currentPeriodEnd: timestamp
// - cancelAtPeriodEnd: boolean
// - createdAt: timestamp
// - updatedAt: timestamp

// subscription_plans collection:
// - id: string (plan name: 'premium', 'creator')
// - name: string
// - description: string
// - price: number (in cents)
// - currency: string
// - interval: 'month' | 'year'
// - features: string[]
// - stripePriceId: string

const PLANS = {
  premium: {
    name: 'Premium',
    price: 499, // $4.99
    currency: 'USD',
    interval: 'month',
    features: [
      'Ad-free experience',
      'Advanced analytics',
      'Post scheduling',
      'Custom themes',
      'Priority support',
    ],
  },
  creator: {
    name: 'Creator',
    price: 999, // $9.99
    currency: 'USD',
    interval: 'month',
    features: [
      'All Premium features',
      'Creator analytics dashboard',
      'Audience insights',
      'A/B testing for posts',
      'Brand marketplace access',
      'Verified badge',
    ],
  },
};

/**
 * Get user's subscription
 */
export async function getUserSubscription(db, userId) {
  const subRef = doc(db, "subscriptions", userId);
  const snap = await getDoc(subRef);
  
  if (!snap.exists()) {
    return {
      plan: 'free',
      status: 'active',
      features: [],
    };
  }
  
  return snap.data();
}

/**
 * Check if user has specific feature access
 */
export async function hasFeature(db, userId, feature) {
  const sub = await getUserSubscription(db, userId);
  
  if (sub.plan === 'free') {
    return false;
  }
  
  const plan = PLANS[sub.plan];
  return plan && plan.features.includes(feature);
}

/**
 * Create subscription (called after Stripe checkout)
 */
export async function createSubscription(db, userId, plan, stripeSubscriptionId, stripeCustomerId) {
  const subRef = doc(db, "subscriptions", userId);
  
  await setDoc(subRef, {
    userId,
    plan,
    status: 'active',
    stripeSubscriptionId,
    stripeCustomerId,
    currentPeriodStart: serverTimestamp(),
    currentPeriodEnd: serverTimestamp(),
    cancelAtPeriodEnd: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(db, userId) {
  const subRef = doc(db, "subscriptions", userId);
  
  await updateDoc(subRef, {
    cancelAtPeriodEnd: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update subscription status (webhook from Stripe)
 */
export async function updateSubscriptionStatus(db, userId, status, periodEnd) {
  const subRef = doc(db, "subscriptions", userId);
  
  await updateDoc(subRef, {
    status,
    currentPeriodEnd: periodEnd,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all subscription plans
 */
export function getSubscriptionPlans() {
  return PLANS;
}

/**
 * Check if user is premium
 */
export async function isPremium(db, userId) {
  const sub = await getUserSubscription(db, userId);
  return sub.plan === 'premium' || sub.plan === 'creator';
}

/**
 * Check if user is creator
 */
export async function isCreator(db, userId) {
  const sub = await getUserSubscription(db, userId);
  return sub.plan === 'creator';
}

/**
 * Get subscription status for UI
 */
export async function getSubscriptionStatus(db, userId) {
  const sub = await getUserSubscription(db, userId);
  const plan = PLANS[sub.plan];
  
  return {
    plan: sub.plan,
    status: sub.status,
    planName: plan ? plan.name : 'Free',
    price: plan ? `$${(plan.price / 100).toFixed(2)}/${plan.interval}` : 'Free',
    features: plan ? plan.features : [],
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
    currentPeriodEnd: sub.currentPeriodEnd,
  };
}
