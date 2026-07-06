const admin = require('firebase-admin');

/**
 * Create subscription in Firestore after successful payment
 */
async function createSubscription(db, userId, plan, transactionId) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Determine plan details
  const planDetails = {
    premium: { name: 'Premium', price: 4.99, durationDays: 30 },
    creator: { name: 'Creator', price: 9.99, durationDays: 30 },
  };

  const details = planDetails[plan] || planDetails.premium;

  // Calculate period dates
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + details.durationDays);

  // Create subscription record
  await db.collection('subscriptions').doc(userId).set(
    {
      plan,
      planName: details.name,
      price: details.price,
      transactionId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
      createdAt: now,
      cancelAtPeriodEnd: false,
    },
    { merge: true }
  );

  console.log(`✅ Subscription created: ${userId} - ${plan}`);
}

module.exports = { createSubscription };
