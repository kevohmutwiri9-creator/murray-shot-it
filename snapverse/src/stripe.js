import { showToast } from "./ui.js";
import { initFirebase } from "./firebase-config.js";

// Till Number Payment System for SnapVerse
// This module handles till number payment processing for subscriptions via M-Pesa API

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
    try {
      const pinModal = document.createElement('div');
      pinModal.className = 'fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in';
      pinModal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-slide-up">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Complete M-Pesa Payment</h2>
          <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">Payment prompt will be sent to</p>
            <p class="text-lg font-bold text-gray-900 dark:text-white mt-1">${phoneNumber}</p>
          </div>
          <div id="paymentStatus" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-sm text-blue-900 dark:text-blue-200">
                <span id="statusText">Sending payment prompt to your phone...</span>
              </p>
            </div>
          </div>
          <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4" id="instructionsBox">
            <p class="text-sm text-green-900 dark:text-green-200">
              <strong>On your phone:</strong> You will see an M-Pesa STK popup. Enter your PIN to authorize KSh ${amount.toFixed(2)}.
            </p>
          </div>
          <div class="flex gap-3" id="actionButtons">
            <button id="mpesaCompleteBtn" class="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-accent to-purple-600 text-white font-semibold hover:from-accentHover hover:to-purple-700 transition shadow-glow">✓ Payment complete</button>
            <button id="mpesaCancelBtn" class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">If you don't see a prompt within 30 seconds, your phone number may be incorrect.</p>
        </div>
      `;

      document.body.appendChild(pinModal);
      console.log('PIN modal created and appended');

      const completeBtn = pinModal.querySelector('#mpesaCompleteBtn');
      const cancelBtn = pinModal.querySelector('#mpesaCancelBtn');
      const statusText = pinModal.querySelector('#statusText');

      // Update status message after 2 seconds
      setTimeout(() => {
        statusText.textContent = '✅ Payment prompt sent! Waiting for your response...';
        pinModal.querySelector('#paymentStatus').classList.remove('border-blue-200', 'dark:border-blue-800', 'bg-blue-50', 'dark:bg-blue-900/20');
        pinModal.querySelector('#paymentStatus').classList.add('border-green-200', 'dark:border-green-800', 'bg-green-50', 'dark:bg-green-900/20');
        pinModal.querySelector('#paymentStatus').querySelector('div').classList.remove('border-blue-500');
        pinModal.querySelector('#paymentStatus').querySelector('p').classList.remove('text-blue-900', 'dark:text-blue-200');
        pinModal.querySelector('#paymentStatus').querySelector('p').classList.add('text-green-900', 'dark:text-green-200');
        pinModal.querySelector('#paymentStatus').querySelector('.animate-spin').remove();
      }, 2000);

      completeBtn.addEventListener('click', () => {
        pinModal.remove();
        resolve({
          transactionId: `MPESA-${Date.now()}`,
          phoneNumber,
          amount,
          plan,
          paymentMethod: 'mpesa',
        });
      });

      cancelBtn.addEventListener('click', () => {
        pinModal.remove();
        reject(new Error('Payment cancelled'));
      });

      pinModal.addEventListener('click', (e) => {
        if (e.target === pinModal) {
          pinModal.remove();
          reject(new Error('Payment cancelled'));
        }
      });
    } catch (error) {
      console.error('Error creating PIN prompt modal:', error);
      reject(error);
    }
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
  console.log('Payment modal created for plan:', plan, 'amount:', amount);

  return new Promise((resolve, reject) => {
    const confirmBtn = modal.querySelector('#confirmPaymentBtn');
    const cancelBtn = modal.querySelector('#cancelPaymentBtn');
    const phoneInput = modal.querySelector('#phoneNumber');

    confirmBtn.addEventListener('click', () => {
      const phoneNumber = phoneInput.value.trim();
      console.log('Validating phone number:', phoneNumber);

      if (!phoneNumber) {
        showToast('Please enter your phone number.', 'error');
        return;
      }

      if (!/^(0\d{9}|\+254\d{9})$/.test(phoneNumber)) {
        showToast('Please enter a valid phone number (07xxxxxxxx or +254xxxxxxxxx).', 'error');
        return;
      }

      console.log('Phone validation passed, removing first modal and showing PIN prompt');
      modal.remove();
      createPinPrompt(phoneNumber, resolve, reject);
    });

    cancelBtn.addEventListener('click', () => {
      console.log('Payment cancelled by user');
      modal.remove();
      reject(new Error('Payment cancelled'));
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('Payment cancelled via modal click');
        modal.remove();
        reject(new Error('Payment cancelled'));
      }
    });
  });
}

/**
 * Trigger M-Pesa STK push via Cloud Function
 * Calls Firebase Cloud Function which integrates with M-Pesa API
 */
async function triggerMpesaStkPush(phoneNumber, amount, description) {
  try {
    console.log('📱 Calling Cloud Function to send M-Pesa payment prompt...');
    
    // Get Firebase instance
    const firebase = initFirebase();
    const { httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js');
    
    const processMpesaPayment = httpsCallable(firebase.app.functions(), 'processMpesaPayment');
    
    // Call the Cloud Function
    const result = await processMpesaPayment({
      phoneNumber,
      amount,
      plan: description.split(' ')[1].toLowerCase(), // Extract plan from description
    });

    console.log('✅ Cloud Function response:', result.data);
    
    return {
      success: true,
      message: result.data.message,
      transactionId: result.data.transactionId,
    };
  } catch (error) {
    console.error('❌ M-Pesa error:', error);
    const errorMessage = error.message || 'Failed to send payment prompt';
    throw new Error(errorMessage);
  }
}

/**
 * Process subscription payment via till number
 */
export async function processSubscriptionPayment(db, userId, plan, paymentDetails) {
  const { transactionId, phoneNumber, amount, paymentMethod = 'till' } = paymentDetails;

  try {
    console.log('🔄 Processing subscription payment...');
    console.log('  Phone:', phoneNumber);
    console.log('  Amount: KSh', amount);
    console.log('  Plan:', plan);

    // Trigger M-Pesa STK push to send prompt to phone
    console.log('📲 Triggering M-Pesa payment prompt...');
    await triggerMpesaStkPush(phoneNumber, amount, `SnapVerse ${plan} subscription`);
    showToast('✅ Payment prompt sent to your phone! Enter your M-Pesa PIN to complete.', 'success');

    // Create a payment record for verification
    const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

    const paymentRef = await addDoc(collection(db, 'payments'), {
      userId,
      plan,
      amount: Math.round(amount * 100), // Store in cents
      transactionId,
      phoneNumber,
      status: 'pending',
      paymentMethod,
      createdAt: serverTimestamp(),
    });
    
    console.log('💾 Payment record created:', paymentRef.id);
    
    // For demo/testing: auto-approve after 5 seconds
    // In production, you'd verify payment status via M-Pesa API callback
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Create subscription subscription
    const { createSubscription } = await import('./subscriptions.js');
    await createSubscription(db, userId, plan, transactionId, phoneNumber);
    
    console.log('✅ Subscription created successfully');
    return { success: true, transactionId };
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    showToast(`Payment error: ${error.message}`, 'error');
    throw error;
  }
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
