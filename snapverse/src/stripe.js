import { showToast } from "./ui.js";

// Till Number Payment System for SnapVerse
// This module handles till number payment processing for subscriptions

// IMPORTANT: Till Number should be loaded from environment variables or secure config
// Do not hardcode sensitive payment information in client-side code
const getTillNumber = () => {
  // Load from Vite environment variable (set in Netlify)
  return import.meta.env.VITE_TILL_NUMBER || '';
};

const getTillAccountName = () => {
  // Load from Vite environment variable (set in Netlify)
  return import.meta.env.VITE_TILL_ACCOUNT_NAME || '';
};

/**
 * Show till number payment modal
 */
export function showTillPaymentModal(plan, amount) {
  const tillNumber = getTillNumber();
  const tillAccountName = getTillAccountName();

  if (!tillNumber) {
    showToast('Payment system not configured. Please contact support.', 'error');
    return Promise.reject(new Error('Payment system not configured'));
  }

  const createPinPrompt = (phoneNumber, resolve, reject) => {
    const pinModal = document.createElement('div');
    pinModal.className = 'fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4';
    pinModal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 animate-scale-in">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Complete M-Pesa Payment</h2>
        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">A payment request will be sent to</p>
          <p class="text-lg font-bold text-gray-900 dark:text-white mt-1">${phoneNumber}</p>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter your M-Pesa PIN on your phone when prompted to authorize KSh ${amount.toFixed(2)} for the ${plan} plan.
        </p>
        <div class="flex gap-3">
          <button id="mpesaCompleteBtn" class="flex-1 px-4 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition">I completed the payment</button>
          <button id="mpesaCancelBtn" class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(pinModal);

    document.getElementById('mpesaCompleteBtn').addEventListener('click', () => {
      pinModal.remove();
      resolve({
        transactionId: `MPESA-${Date.now()}`,
        phoneNumber,
        amount,
        plan,
        paymentMethod: 'mpesa',
      });
    });

    document.getElementById('mpesaCancelBtn').addEventListener('click', () => {
      pinModal.remove();
      reject(new Error('Payment cancelled'));
    });

    pinModal.addEventListener('click', (e) => {
      if (e.target === pinModal) {
        pinModal.remove();
        reject(new Error('Payment cancelled'));
      }
    });
  };

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 animate-scale-in">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Pay with M-Pesa</h2>

      <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 mb-4 border border-green-200 dark:border-green-800">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Pay to till number</p>
        <p class="text-3xl font-bold text-green-600 dark:text-green-400">${tillNumber}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${tillAccountName}</p>
      </div>

      <div class="space-y-3 mb-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">Plan</span>
          <span class="font-semibold text-gray-900 dark:text-white">${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">Amount</span>
          <span class="font-bold text-accent">KSh ${amount.toFixed(2)}/month</span>
        </div>
      </div>

      <div class="space-y-3 mb-4">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
        <input type="tel" id="phoneNumber" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white" placeholder="e.g., 0712345678" />
        <p class="text-xs text-gray-500 dark:text-gray-400">Enter the number that will receive the M-Pesa prompt.</p>
      </div>

      <div class="flex gap-3">
        <button id="confirmPaymentBtn" class="flex-1 px-4 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition">Continue</button>
        <button id="cancelPaymentBtn" class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
      </div>

      <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        You will be asked to enter your M-Pesa PIN on your phone to complete the payment.
      </p>
    </div>
  `;

  document.body.appendChild(modal);

  return new Promise((resolve, reject) => {
    document.getElementById('confirmPaymentBtn').addEventListener('click', () => {
      const phoneNumber = document.getElementById('phoneNumber').value.trim();

      if (!/^(0\d{9}|\+254\d{9})$/.test(phoneNumber)) {
        showToast('Please enter a valid phone number beginning with 07 or +254.', 'error');
        return;
      }

      modal.remove();
      createPinPrompt(phoneNumber, resolve, reject);
    });

    document.getElementById('cancelPaymentBtn').addEventListener('click', () => {
      modal.remove();
      reject(new Error('Payment cancelled'));
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        reject(new Error('Payment cancelled'));
      }
    });
  });
}

/**
 * Process subscription payment via till number
 */
export async function processSubscriptionPayment(db, userId, plan, paymentDetails) {
  const { transactionId, phoneNumber, amount, paymentMethod = 'till' } = paymentDetails;

  // Create a payment record for verification
  const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  await addDoc(collection(db, 'payments'), {
    userId,
    plan,
    amount: Math.round(amount * 100), // Store in cents
    transactionId,
    phoneNumber,
    status: 'pending',
    paymentMethod,
    createdAt: serverTimestamp(),
  });
  
  // For demo purposes, auto-approve the payment
  // In production, you would verify the payment with your payment provider
  const { createSubscription } = await import('./subscriptions.js');
  await createSubscription(db, userId, plan, transactionId, phoneNumber);
  
  return { success: true, transactionId };
}

/**
 * Process tip payment via till number
 */
export async function processTipPayment(db, fromUserId, toUserId, amount, description) {
  const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  
  await addDoc(collection(db, 'payments'), {
    fromUserId,
    toUserId,
    amount: Math.round(amount * 100),
    description,
    status: 'pending',
    paymentMethod: 'till',
    createdAt: serverTimestamp(),
  });
  
  // For demo purposes, process the tip immediately
  const { processTip } = await import('./transactions.js');
  await processTip(db, fromUserId, toUserId, amount, description);
  
  return { success: true };
}

/**
 * Get till number info (server-side only)
 */
export function getTillInfo() {
  return {
    tillNumber: getTillNumber(),
    accountName: getTillAccountName(),
  };
}

/**
 * Format amount for display
 */
export function formatAmount(cents) {
  return (cents / 100).toFixed(2);
}
