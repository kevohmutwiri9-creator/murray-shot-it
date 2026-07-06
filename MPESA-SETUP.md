# Firebase Cloud Functions Setup

## Prerequisites

1. **Firebase Project** - You already have: `snapverse-32683`
2. **M-Pesa API Credentials** - Get from https://developer.safaricom.co.ke/
3. **Node.js 18+** - Already installed

## Setup Steps

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Environment Variables

Create `.env` file in functions directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your M-Pesa credentials:
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_PASSKEY`
- `MPESA_TILL_NUMBER` (already: 4799353)

### 3. Deploy Functions to Firebase

```bash
firebase deploy --only functions
```

This deploys:
- `processMpesaPayment` - Initiates M-Pesa payment
- `mpesaCallback` - Receives payment status from Safaricom
- `health` - Health check endpoint

### 4. Get M-Pesa Credentials

**For Testing (Sandbox):**
1. Go to https://developer.safaricom.co.ke/
2. Log in or create account
3. Create a new App
4. Under "My Apps", select your app
5. Go to "OAuth Credentials"
6. Copy:
   - Consumer Key
   - Consumer Secret
   - Passkey (from M-Pesa Express)

**For Production:**
- Contact Safaricom to move from sandbox to production
- Update endpoints from `sandbox.safaricom.co.ke` to `api.safaricom.co.ke`

### 5. Update Frontend

The frontend (`stripe.js`) is already configured to call the Cloud Function.

### 6. Test the Flow

1. Go to Subscriptions page
2. Click "Subscribe to Premium" or "Creator"
3. Enter your phone number (07xxxxxxxx)
4. Click "Continue"
5. Watch for M-Pesa prompt on your phone
6. Enter M-Pesa PIN to complete payment

## Monitoring

Check Cloud Functions logs:

```bash
firebase functions:log
```

View payment history in Firestore:
- Collection: `payments`
- Collection: `payment_errors` (if any failures)

## Production Checklist

- [ ] Configure Safaricom API credentials
- [ ] Deploy Cloud Functions
- [ ] Update `MPESA_CALLBACK_URL` to production domain
- [ ] Set up Firestore rules for payments collection
- [ ] Test with real M-Pesa account
- [ ] Enable Cloud Functions logs in Firebase Console
- [ ] Set up error alerting (optional)
