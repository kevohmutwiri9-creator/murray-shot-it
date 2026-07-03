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
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";

// brand_campaigns collection:
// - id: string
// - brandId: string (brand user ID)
// - title: string
// - description: string
// - imageUrl: string
// - budget: number (in cents)
// - spent: number (in cents)
// - requirements: {
//   - followerCount: number (minimum followers required)
//   - engagementRate: number (minimum engagement rate)
//   - niche: string[] (required niches/interests)
//   - demographics: { ageRange, gender, locations }
//   - contentType: string[] (photo, video, story, reel)
//   - deliverables: string[] (post count, story count, etc.)
//   - timeline: { startDate, endDate }
// }
// - compensation: {
//   - type: 'flat_fee' | 'cpm' | 'affiliate' | 'hybrid'
//   - amount: number (in cents)
//   - affiliateCommission: number (percentage)
// }
// - status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled'
// - applicants: string[] (creator IDs who applied)
// - selectedCreators: string[] (creator IDs selected for campaign)
// - createdAt: timestamp
// - updatedAt: timestamp

// campaign_applications collection:
// - id: string
// - campaignId: string
// - creatorId: string
// - status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
// - proposal: string
// - rate: number (requested rate in cents)
// - portfolio: string[] (links to previous work)
// - createdAt: timestamp
// - updatedAt: timestamp

// campaign_deliverables collection:
// - id: string
// - campaignId: string
// - creatorId: string
// - type: 'post' | 'story' | 'reel' | 'video'
// - postId: string (link to actual post)
// - status: 'pending' | 'submitted' | 'approved' | 'rejected'
// - submittedAt: timestamp
// - approvedAt: timestamp
// - feedback: string

/**
 * Create a new brand campaign
 */
export async function createCampaign(db, brandId, campaignData) {
  const campaignsRef = collection(db, "brand_campaigns");
  
  const campaign = {
    ...campaignData,
    brandId,
    status: 'draft',
    spent: 0,
    applicants: [],
    selectedCreators: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(campaignsRef, campaign);
  return docRef.id;
}

/**
 * Get campaigns by brand
 */
export async function getBrandCampaigns(db, brandId) {
  const campaignsRef = collection(db, "brand_campaigns");
  const q = query(
    campaignsRef,
    where("brandId", "==", brandId),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get open campaigns for creators
 */
export async function getOpenCampaigns(db, creatorData) {
  const campaignsRef = collection(db, "brand_campaigns");
  const q = query(
    campaignsRef,
    where("status", "==", "open"),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filter by creator eligibility
  return campaigns.filter(campaign => {
    const req = campaign.requirements;
    
    // Check follower count
    if (req.followerCount && creatorData.followerCount < req.followerCount) {
      return false;
    }
    
    // Check engagement rate
    if (req.engagementRate && creatorData.engagementRate < req.engagementRate) {
      return false;
    }
    
    // Check niche match
    if (req.niche && req.niche.length > 0) {
      const hasNiche = req.niche.some(n => creatorData.niche?.includes(n));
      if (!hasNiche) return false;
    }
    
    return true;
  });
}

/**
 * Apply to a campaign
 */
export async function applyToCampaign(db, campaignId, creatorId, applicationData) {
  const applicationsRef = collection(db, "campaign_applications");
  
  // Check if already applied
  const existingQ = query(
    applicationsRef,
    where("campaignId", "==", campaignId),
    where("creatorId", "==", creatorId)
  );
  const existingSnap = await getDocs(existingQ);
  
  if (!existingSnap.empty) {
    throw new Error('Already applied to this campaign');
  }
  
  const application = {
    campaignId,
    creatorId,
    status: 'pending',
    ...applicationData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(applicationsRef, application);
  
  // Add to campaign applicants
  const campaignRef = doc(db, "brand_campaigns", campaignId);
  await updateDoc(campaignRef, {
    applicants: arrayUnion(creatorId),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

/**
 * Get applications for a campaign
 */
export async function getCampaignApplications(db, campaignId) {
  const applicationsRef = collection(db, "campaign_applications");
  const q = query(
    applicationsRef,
    where("campaignId", "==", campaignId),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Accept application
 */
export async function acceptApplication(db, applicationId) {
  const applicationRef = doc(db, "campaign_applications", applicationId);
  const snap = await getDoc(applicationRef);
  
  if (!snap.exists()) throw new Error('Application not found');
  
  const application = snap.data();
  
  await updateDoc(applicationRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
  
  // Add to selected creators
  const campaignRef = doc(db, "brand_campaigns", application.campaignId);
  await updateDoc(campaignRef, {
    selectedCreators: arrayUnion(application.creatorId),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reject application
 */
export async function rejectApplication(db, applicationId) {
  const applicationRef = doc(db, "campaign_applications", applicationId);
  
  await updateDoc(applicationRef, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Submit campaign deliverable
 */
export async function submitDeliverable(db, campaignId, creatorId, deliverableData) {
  const deliverablesRef = collection(db, "campaign_deliverables");
  
  const deliverable = {
    campaignId,
    creatorId,
    status: 'submitted',
    submittedAt: serverTimestamp(),
    ...deliverableData,
  };
  
  const docRef = await addDoc(deliverablesRef, deliverable);
  return docRef.id;
}

/**
 * Approve deliverable
 */
export async function approveDeliverable(db, deliverableId, feedback = '') {
  const deliverableRef = doc(db, "campaign_deliverables", deliverableId);
  
  await updateDoc(deliverableRef, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    feedback,
  });
  
  // Process payment to creator
  const snap = await getDoc(deliverableRef);
  const deliverable = snap.data();
  
  const { processTip } = await import("./transactions.js");
  const campaignSnap = await getDoc(doc(db, "brand_campaigns", deliverable.campaignId));
  const campaign = campaignSnap.data();
  
  if (campaign.compensation.type === 'flat_fee') {
    await processTip(db, campaign.brandId, deliverable.creatorId, campaign.compensation.amount, 'Campaign deliverable payment');
  }
}

/**
 * Reject deliverable
 */
export async function rejectDeliverable(db, deliverableId, feedback) {
  const deliverableRef = doc(db, "campaign_deliverables", deliverableId);
  
  await updateDoc(deliverableRef, {
    status: 'rejected',
    feedback,
  });
}

/**
 * Get creator's campaign applications
 */
export async function getCreatorApplications(db, creatorId) {
  const applicationsRef = collection(db, "campaign_applications");
  const q = query(
    applicationsRef,
    where("creatorId", "==", creatorId),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get campaign deliverables
 */
export async function getCampaignDeliverables(db, campaignId) {
  const deliverablesRef = collection(db, "campaign_deliverables");
  const q = query(
    deliverablesRef,
    where("campaignId", "==", campaignId),
    orderBy("submittedAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update campaign status
 */
export async function updateCampaignStatus(db, campaignId, status) {
  const campaignRef = doc(db, "brand_campaigns", campaignId);
  
  await updateDoc(campaignRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get campaign analytics
 */
export async function getCampaignAnalytics(db, campaignId) {
  const campaignRef = doc(db, "brand_campaigns", campaignId);
  const snap = await getDoc(campaignRef);
  
  if (!snap.exists()) return null;
  
  const campaign = snap.data();
  const applications = await getCampaignApplications(db, campaignId);
  const deliverables = await getCampaignDeliverables(db, campaignId);
  
  const accepted = applications.filter(a => a.status === 'approved').length;
  const pending = applications.filter(a => a.status === 'pending').length;
  const completed = deliverables.filter(d => d.status === 'approved').length;
  
  return {
    campaign,
    totalApplications: applications.length,
    accepted,
    pending,
    completed,
    budgetRemaining: campaign.budget - campaign.spent,
  };
}
