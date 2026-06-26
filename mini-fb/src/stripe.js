// Till Number Payment System for SnapVerse
// This module handles till number payment processing for subscriptions

// IMPORTANT: Till Number should be loaded from environment variables or secure config
// Do not hardcode sensitive payment information in client-side code
const getTillNumber = () => {
  // In production, load from environment variable or secure config
  // For development, you can set this in a .env file or similar
  return import.meta.env.VITE_TILL_NUMBER || process.env.TILL_NUMBER || '';
};

const getTillAccountName = () => {
  // In production, load from environment variable or secure config
  return import.meta.env.VITE_TILL_ACCOUNT_NAME || process.env.TILL_ACCOUNT_NAME || '';
};

/**
 * Show till number payment modal
 */
export function showTillPaymentModal(plan, amount) {
  const tillNumber = getTillNumber();
  const tillAccountName = getTillAccountName();
  
  if (!tillNumber) {
    alert('Payment system not configured. Please contact support.');
    return Promise.reject(new Error('Payment system not configured'));
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 animate-scale-in">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Complete Payment</h2>
      
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 mb-4 border border-green-200 dark:border-green-800">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Pay via Till Number</p>
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
          <span class="font-bold text-accent">$${amount.toFixed(2)}/month</span>
        </div>
      </div>
      
      <div class="space-y-3 mb-4">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Transaction ID / M-Pesa Code</label>
        <input type="text" id="transactionId" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white" placeholder="Enter your transaction ID" />
        <p class="text-xs text-gray-500 dark:text-gray-400">Enter the transaction ID from your payment confirmation SMS</p>
      </div>
      
      <div class="space-y-3 mb-4">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
        <input type="tel" id="phoneNumber" class="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white" placeholder="e.g., 0712345678" />
      </div>
      
      <div class="flex gap-3">
        <button id="confirmPaymentBtn" class="flex-1 px-4 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition">Confirm Payment</button>
        <button id="cancelPaymentBtn" class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
      </div>
      
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        Your subscription will be activated after payment verification
      </p>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  return new Promise((resolve, reject) => {
    document.getElementById('confirmPaymentBtn').addEventListener('click', () => {
      const transactionId = document.getElementById('transactionId').value;
      const phoneNumber = document.getElementById('phoneNumber').value;
      
      if (!transactionId || !phoneNumber) {
        alert('Please enter both transaction ID and phone number');
        return;
      }
      
      modal.remove();
      resolve({ transactionId, phoneNumber, amount, plan });
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
  const { transactionId, phoneNumber, amount } = paymentDetails;
  
  // Create a payment record for verification
  const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  
  await addDoc(collection(db, 'payments'), {
    userId,
    plan,
    amount: Math.round(amount * 100), // Store in cents
    transactionId,
    phoneNumber,
    status: 'pending',
    paymentMethod: 'till',
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
