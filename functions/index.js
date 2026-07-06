const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Get M-Pesa Access Token
 * This authenticates with Safaricom's OAuth server
 */
async function getMpesaAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret || consumerKey === 'your_consumer_key_here') {
    throw new Error(
      'M-Pesa Consumer Key or Secret not configured.\n\n' +
      'Get credentials from: https://developer.safaricom.co.ke/\n' +
      'See GET-MPESA-PASSKEY.md for detailed instructions.'
    );
  }

  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting M-Pesa access token:', error.message);
    throw new Error('Failed to authenticate with M-Pesa API. Check your Consumer Key and Secret.');
  }
}

/**
 * Initiate M-Pesa STK Push (payment prompt on phone)
 * Falls back to demo mode if credentials not available
 */
async function initiateMpesaStkPush(phoneNumber, amount, accountReference, description) {
  try {
    const passkey = process.env.MPESA_PASSKEY;

    // Check if passkey is configured
    if (!passkey || passkey === 'n/a' || passkey === 'your_passkey_here') {
      throw new Error(
        '❌ M-Pesa Passkey not configured!\n\n' +
        'To set up real payments:\n' +
        '1. Go to https://developer.safaricom.co.ke/\n' +
        '2. Get your Passkey from M-Pesa Express section\n' +
        '3. Add to functions/.env:\n' +
        '   MPESA_PASSKEY=your_passkey_here\n' +
        '4. Deploy: firebase deploy --only functions\n\n' +
        'See GET-MPESA-PASSKEY.md for detailed instructions'
      );
    }

    const accessToken = await getMpesaAccessToken();
    const tillNumber = process.env.MPESA_TILL_NUMBER || '4799353';
    const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://snapverse.app/api/mpesa/callback';

    // Format phone number (remove leading 0, add 254)
    let formattedPhone = phoneNumber;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    }

    // Real M-Pesa API request
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${tillNumber}${passkey}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: tillNumber,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: tillNumber,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: description,
    };

    console.log('🚀 Sending M-Pesa STK push to:', formattedPhone);
    console.log('Amount: KSh', amount);

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ STK Push initiated:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ M-Pesa error:', error.response?.data || error.message);
    throw new Error(`M-Pesa error: ${error.response?.data?.errorMessage || error.message}`);
  }
}

/**
 * Cloud Function: Process M-Pesa Payment
 * Called from frontend when user clicks subscribe
 */
exports.processMpesaPayment = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
  }

  const { phoneNumber, amount, plan } = data;
  const userId = context.auth.uid;

  try {
    console.log(`\n🔄 Processing M-Pesa payment for user ${userId}`);
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Amount: ${amount}`);
    console.log(`   Plan: ${plan}`);

    // Validate inputs
    if (!phoneNumber || !amount || !plan) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    if (!/^(0\d{9}|\+254\d{9})$/.test(phoneNumber)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid phone number format');
    }

    // Create transaction record
    const transactionId = `MPESA-${Date.now()}`;
    const paymentRef = await db.collection('payments').add({
      userId,
      phoneNumber,
      amount: Math.round(amount * 100), // Store in cents
      plan,
      transactionId,
      status: 'pending',
      paymentMethod: 'mpesa',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`💾 Payment record created: ${paymentRef.id}`);

    // Initiate M-Pesa STK push
    const mpesaResponse = await initiateMpesaStkPush(
      phoneNumber,
      amount,
      `SNAPVERSE-${plan.toUpperCase()}`,
      `SnapVerse ${plan} subscription`
    );

    // Update payment record with M-Pesa response
    await paymentRef.update({
      mpesaRequestId: mpesaResponse.MerchantRequestID || mpesaResponse.RequestID || 'unknown',
      mpesaCheckoutRequestId: mpesaResponse.CheckoutRequestID,
      stkPushSent: true,
      stkPushSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n✅ M-Pesa payment initiated successfully`);
    console.log(`   Transaction ID: ${transactionId}`);
    console.log(`   M-Pesa Request ID: ${mpesaResponse.MerchantRequestID || mpesaResponse.RequestID}`);

    return {
      success: true,
      transactionId,
      messageId: mpesaResponse.ResponseDescription || mpesaResponse.MessageDesc || 'OK',
      message: '✅ Payment prompt sent to your phone! Enter your M-Pesa PIN to complete subscription.',
    };
  } catch (error) {
    console.error(`\n❌ Payment error: ${error.message}`);

    // Log error to Firestore for debugging
    await db.collection('payment_errors').add({
      userId,
      phoneNumber: data.phoneNumber,
      plan,
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * M-Pesa Callback Handler
 * Safaricom sends payment status here (only used in live mode)
 */
exports.mpesaCallback = functions.https.onRequest(async (req, res) => {
  try {
    const { Body } = req.body;
    const stkCallback = Body.stkCallback;

    console.log('📞 M-Pesa Callback received:', stkCallback);

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    // Find payment by CheckoutRequestID
    const paymentSnapshot = await db
      .collection('payments')
      .where('mpesaCheckoutRequestId', '==', CheckoutRequestID)
      .limit(1)
      .get();

    if (paymentSnapshot.empty) {
      console.warn('Payment not found for CheckoutRequestID:', CheckoutRequestID);
      return res.json({ status: 'ok' });
    }

    const paymentDoc = paymentSnapshot.docs[0];
    const payment = paymentDoc.data();

    if (ResultCode === 0) {
      // Payment successful
      console.log(`✅ Payment successful for transaction: ${payment.transactionId}`);

      // Extract payment details
      let mpesaReceiptNumber = '';
      let mpesaTransactionDate = '';
      let mpesaAmount = 0;

      if (CallbackMetadata && CallbackMetadata.Item) {
        CallbackMetadata.Item.forEach((item) => {
          if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
          if (item.Name === 'TransactionDate') mpesaTransactionDate = item.Value;
          if (item.Name === 'Amount') mpesaAmount = item.Value;
        });
      }

      // Update payment record
      await paymentDoc.ref.update({
        status: 'completed',
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        mpesaReceiptNumber,
        mpesaTransactionDate,
        mpesaAmount,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create subscription for user
      const { createSubscription } = require('./subscriptions-helper');
      await createSubscription(db, payment.userId, payment.plan, payment.transactionId);

      console.log(`🎉 Subscription created for user: ${payment.userId}`);
    } else {
      // Payment failed
      console.log(`❌ Payment failed: ${ResultDesc}`);
      await paymentDoc.ref.update({
        status: 'failed',
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health Check
 */
exports.health = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
  });
});
