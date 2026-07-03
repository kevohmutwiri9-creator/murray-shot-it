import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";

// transactions collection:
// - id: string
// - type: 'tip' | 'subscription' | 'product_sale' | 'withdrawal' | 'brand_deal'
// - fromUserId: string
// - toUserId: string
// - amount: number (in cents)
// - currency: string
// - status: 'pending' | 'completed' | 'failed' | 'refunded'
// - description: string
// - metadata: object (additional data based on type)
// - stripePaymentIntentId: string (for Stripe integration)
// - createdAt: timestamp
// - completedAt: timestamp

// wallets collection:
// - id: string (userId)
// - userId: string
// - balance: number (in cents)
// - pendingBalance: number (in cents)
// - totalEarned: number (in cents)
// - totalWithdrawn: number (in cents)
// - stripeAccountId: string (for creator payouts)
// - payoutMethod: object
// - createdAt: timestamp
// - updatedAt: timestamp

/**
 * Get user wallet
 */
export async function getUserWallet(db, userId) {
  const walletRef = doc(db, "wallets", userId);
  const snap = await getDoc(walletRef);
  
  if (!snap.exists()) {
    // Create wallet if it doesn't exist
    await setDoc(walletRef, {
      userId,
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return {
      userId,
      balance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    };
  }
  
  return snap.data();
}

/**
 * Create a transaction
 */
export async function createTransaction(db, transactionData) {
  const transactionsRef = collection(db, "transactions");
  
  const transaction = {
    ...transactionData,
    status: 'pending',
    createdAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(transactionsRef, transaction);
  return docRef.id;
}

/**
 * Process tip transaction
 */
export async function processTip(db, fromUserId, toUserId, amount, description = 'Tip') {
  return await runTransaction(db, async (transaction) => {
    // Create transaction record
    const transactionsRef = collection(db, "transactions");
    const newTransactionRef = doc(transactionsRef);
    
    await transaction.set(newTransactionRef, {
      type: 'tip',
      fromUserId,
      toUserId,
      amount,
      currency: 'USD',
      status: 'pending',
      description,
      createdAt: serverTimestamp(),
    });
    
    // Update sender's wallet (deduct)
    const senderWalletRef = doc(db, "wallets", fromUserId);
    const senderWallet = await transaction.get(senderWalletRef);
    
    if (!senderWallet.exists() || senderWallet.data().balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    await transaction.update(senderWalletRef, {
      balance: increment(-amount),
      updatedAt: serverTimestamp(),
    });
    
    // Update recipient's wallet (add to pending)
    const recipientWalletRef = doc(db, "wallets", toUserId);
    const recipientWallet = await transaction.get(recipientWalletRef);
    
    if (!recipientWallet.exists()) {
      await transaction.set(recipientWalletRef, {
        userId: toUserId,
        balance: 0,
        pendingBalance: amount,
        totalEarned: amount,
        totalWithdrawn: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await transaction.update(recipientWalletRef, {
        pendingBalance: increment(amount),
        totalEarned: increment(amount),
        updatedAt: serverTimestamp(),
      });
    }
    
    // Mark transaction as completed
    await transaction.update(newTransactionRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
    });
    
    return newTransactionRef.id;
  });
}

/**
 * Process withdrawal request
 */
export async function requestWithdrawal(db, userId, amount, payoutMethod) {
  return await runTransaction(db, async (transaction) => {
    const walletRef = doc(db, "wallets", userId);
    const wallet = await transaction.get(walletRef);
    
    if (!wallet.exists() || wallet.data().balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    // Create withdrawal transaction
    const transactionsRef = collection(db, "transactions");
    const newTransactionRef = doc(transactionsRef);
    
    await transaction.set(newTransactionRef, {
      type: 'withdrawal',
      fromUserId: userId,
      toUserId: userId, // Self-reference for withdrawals
      amount,
      currency: 'USD',
      status: 'pending',
      description: 'Withdrawal',
      metadata: { payoutMethod },
      createdAt: serverTimestamp(),
    });
    
    // Deduct from wallet
    await transaction.update(walletRef, {
      balance: increment(-amount),
      totalWithdrawn: increment(amount),
      updatedAt: serverTimestamp(),
    });
    
    return newTransactionRef.id;
  });
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(db, userId, limit = 50) {
  const transactionsRef = collection(db, "transactions");
  const q = query(
    transactionsRef,
    where("fromUserId", "==", userId),
    orderBy("createdAt", "desc"),
    limit
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get received transactions (tips, etc.)
 */
export async function getReceivedTransactions(db, userId, limit = 50) {
  const transactionsRef = collection(db, "transactions");
  const q = query(
    transactionsRef,
    where("toUserId", "==", userId),
    orderBy("createdAt", "desc"),
    limit
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get wallet balance formatted
 */
export function formatBalance(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars  
 */
export function centsToDollars(cents) {
  return cents / 100;
}

/**
 * Get total earnings for a creator
 */
export async function getTotalEarnings(db, userId) {
  const wallet = await getUserWallet(db, userId);
  return wallet.totalEarned || 0;
}

/**
 * Get pending balance
 */
export async function getPendingBalance(db, userId) {
  const wallet = await getUserWallet(db, userId);
  return wallet.pendingBalance || 0;
}

/**
 * Settle pending balance (after payment processor confirmation)
 */
export async function settlePendingBalance(db, userId, amount) {
  const walletRef = doc(db, "wallets", userId);
  
  await updateDoc(walletRef, {
    pendingBalance: increment(-amount),
    balance: increment(amount),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Refund transaction
 */
export async function refundTransaction(db, transactionId) {
  return await runTransaction(db, async (transaction) => {
    const transactionRef = doc(db, "transactions", transactionId);
    const transactionData = await transaction.get(transactionRef);
    
    if (!transactionData.exists()) {
      throw new Error('Transaction not found');
    }
    
    const data = transactionData.data();
    
    if (data.status !== 'completed') {
      throw new Error('Cannot refund non-completed transaction');
    }
    
    // Refund to sender
    const senderWalletRef = doc(db, "wallets", data.fromUserId);
    await transaction.update(senderWalletRef, {
      balance: increment(data.amount),
      updatedAt: serverTimestamp(),
    });
    
    // Deduct from recipient
    const recipientWalletRef = doc(db, "wallets", data.toUserId);
    await transaction.update(recipientWalletRef, {
      balance: increment(-data.amount),
      totalEarned: increment(-data.amount),
      updatedAt: serverTimestamp(),
    });
    
    // Mark as refunded
    await transaction.update(transactionRef, {
      status: 'refunded',
      updatedAt: serverTimestamp(),
    });
  });
}
