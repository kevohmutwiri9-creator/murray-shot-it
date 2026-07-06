# How to Get M-Pesa Passkey & API Credentials

## Step-by-Step Guide to Get Real M-Pesa Credentials

### 1. Register on Safaricom Developer Portal

Go to: https://developer.safaricom.co.ke/

**What to do:**
- Click "Sign Up" (top right)
- Enter your email and create account
- Verify your email
- Login to dashboard

---

### 2. Create a New App

**After logging in:**
1. Go to "My Apps" section
2. Click "Create Application"
3. Fill in the form:
   - **App Name:** SnapVerse (or your app name)
   - **Description:** Mobile social media app with M-Pesa payments
   - **Type:** Web Application
4. Click "Create"

---

### 3. Get OAuth Credentials (Consumer Key & Secret)

**In your App Dashboard:**
1. Click on your new app
2. Go to "OAuth Credentials" tab
3. You'll see:
   - **Consumer Key** (copy this)
   - **Consumer Secret** (copy this)
4. Save these in a safe place

Example format:
```
Consumer Key: A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0
Consumer Secret: X9y8Z7a6B5c4D3e2F1g0H9i8J7k6L5m4N3o2P1q0
```

---

### 4. Get M-Pesa Passkey

**In your App Dashboard:**
1. Go to "M-Pesa Express" or "Lipa Na M-Pesa Online" section
2. Look for "Passkey"
3. **Copy the passkey** (this is what you need)

Example format:
```
Passkey: bfb279f9aa9bdbcf158e97dd1a503b7a480b31e60cfa70f7ad3c16e8c7e2bc50
```

⚠️ **If you don't see the Passkey:**
- Contact Safaricom at: mpesaapi@safaricom.co.ke
- Or call: +254 700 627 627
- Request activation of M-Pesa Express for your app

---

### 5. Get Your Till Number

**You already have:** 4799353

**To verify it's correct:**
1. Go to "Business Setup" or "Configuration"
2. Find your "Till Number" or "Business Short Code"
3. Should be 4799353

---

### 6. Get Callback URL (Optional for testing)

For testing on your computer:
- Use: `http://localhost:3000/api/mpesa/callback`

For production:
- Replace with your actual domain: `https://yourdomain.com/api/mpesa/callback`

---

## Summary of Credentials You Need

```
MPESA_CONSUMER_KEY=          [Copy from OAuth Credentials]
MPESA_CONSUMER_SECRET=       [Copy from OAuth Credentials]
MPESA_PASSKEY=               [Copy from M-Pesa Express section]
MPESA_TILL_NUMBER=4799353    [Already have this]
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
```

---

## Troubleshooting

**Problem: "I can't find the Passkey"**
- Check if you're in the right app (might have multiple apps)
- Go to "Settings" > "M-Pesa" or "Lipa Na M-Pesa"
- If still not visible, contact Safaricom support

**Problem: "I don't have OAuth Credentials"**
- Make sure your app is "Active"
- Try logging out and back in
- Try creating a new app

**Problem: "Consumer Key/Secret not showing"**
- Go to "My Apps"
- Click on your app name
- Scroll down to "OAuth Credentials"
- You should see them there

---

## Once You Have the Credentials

1. Create `functions/.env` file:
```bash
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_PASSKEY=your_passkey_here
MPESA_TILL_NUMBER=4799353
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
```

2. Deploy Cloud Functions:
```bash
cd functions
npm install
firebase deploy --only functions
```

3. Test the payment flow:
- Go to Subscriptions page
- Click "Subscribe"
- Enter your M-Pesa phone number
- **Real M-Pesa prompt will appear on your phone!**

---

## Contact Safaricom Support

**Email:** mpesaapi@safaricom.co.ke
**Phone:** +254 700 627 627
**Hours:** Monday - Friday, 8 AM - 5 PM EAT

**Tell them:**
- "I need M-Pesa API credentials for my mobile app"
- "I need to activate M-Pesa Express/Lipa Na M-Pesa"
- "I have a till number: 4799353"

---

## Testing with Real M-Pesa

Once you have credentials:

**Test with any M-Pesa enabled phone:**
1. Keep your phone ready
2. Enter your phone number on subscriptions page
3. Click "Subscribe"
4. **Watch your phone** - M-Pesa STK popup will appear
5. Enter your 4-digit M-Pesa PIN
6. Payment complete!

**Charges:** 
- You will be charged KSh 4.99 (Premium) or KSh 9.99 (Creator)
- Real money transaction

---

## Need Help?

1. Check Firebase Console: https://console.firebase.google.com/
2. View Cloud Function logs for errors
3. Check Firestore `payment_errors` collection
4. Email me with error message

Good luck! 🚀
