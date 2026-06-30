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

// products collection:
// - id: string
// - name: string
// - description: string
// - imageUrl: string
// - price: number (in cents)
// - currency: string
// - affiliateUrl: string
// - affiliateCommission: number (percentage, e.g., 10 for 10%)
// - creatorId: string (who added the product)
// - category: string
// - tags: string[]
// - status: 'active' | 'inactive'
// - totalClicks: number
// - totalSales: number
// - totalRevenue: number (in cents)
// - createdAt: timestamp
// - updatedAt: timestamp

// product_tags collection:
// - id: string (postId)
// - postId: string
// - productId: string
// - position: { x: number, y: number } (for overlay positioning)
// - creatorId: string
// - createdAt: timestamp

/**
 * Create a new product
 */
export async function createProduct(db, productData) {
  const productsRef = collection(db, "products");
  
  const product = {
    ...productData,
    status: 'active',
    totalClicks: 0,
    totalSales: 0,
    totalRevenue: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(productsRef, product);
  return docRef.id;
}

/**
 * Get products by creator
 */
export async function getCreatorProducts(db, creatorId) {
  const productsRef = collection(db, "products");
  const q = query(
    productsRef,
    where("creatorId", "==", creatorId),
    where("status", "==", "active"),
    orderBy("createdAt", "desc")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get product by ID
 */
export async function getProduct(db, productId) {
  const productRef = doc(db, "products", productId);
  const snap = await getDoc(productRef);
  
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Tag a product in a post
 */
export async function tagProductInPost(db, postId, productId, creatorId, position) {
  const productTagsRef = collection(db, "product_tags");
  
  await addDoc(productTagsRef, {
    postId,
    productId,
    creatorId,
    position,
    createdAt: serverTimestamp(),
  });
}

/**
 * Get products tagged in a post
 */
export async function getPostProducts(db, postId) {
  const productTagsRef = collection(db, "product_tags");
  const q = query(productTagsRef, where("postId", "==", postId));
  
  const snapshot = await getDocs(q);
  const tags = snapshot.docs.map(doc => doc.data());
  
  // Get product details for each tag
  const products = await Promise.all(
    tags.map(async (tag) => {
      const product = await getProduct(db, tag.productId);
      return { ...tag, product };
    })
  );
  
  return products;
}

/**
 * Track product click
 */
export async function trackProductClick(db, productId, postId, userId) {
  const productRef = doc(db, "products", productId);
  
  await updateDoc(productRef, {
    totalClicks: increment(1),
    updatedAt: serverTimestamp(),
  });
  
  // Log click for analytics
  const clicksRef = collection(db, "product_clicks");
  await addDoc(clicksRef, {
    productId,
    postId,
    userId,
    timestamp: serverTimestamp(),
  });
}

/**
 * Track product sale (called after affiliate conversion)
 */
export async function trackProductSale(db, productId, amount) {
  const productRef = doc(db, "products", productId);
  const snap = await getDoc(productRef);
  
  if (!snap.exists()) return;
  
  const product = snap.data();
  const commission = Math.round(amount * (product.affiliateCommission / 100));
  
  await updateDoc(productRef, {
    totalSales: increment(1),
    totalRevenue: increment(amount),
    updatedAt: serverTimestamp(),
  });
  
  // Add commission to creator's wallet
  const { processTip } = await import("./transactions.js");
  await processTip(db, 'system', product.creatorId, commission, 'Product sale commission');
  
  return commission;
}

/**
 * Update product
 */
export async function updateProduct(db, productId, updates) {
  const productRef = doc(db, "products", productId);
  
  await updateDoc(productRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete product (soft delete - set status to inactive)
 */
export async function deleteProduct(db, productId) {
  const productRef = doc(db, "products", productId);
  
  await updateDoc(productRef, {
    status: 'inactive',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get product analytics for creator
 */
export async function getProductAnalytics(db, creatorId) {
  const products = await getCreatorProducts(db, creatorId);
  
  const totalClicks = products.reduce((sum, p) => sum + (p.totalClicks || 0), 0);
  const totalSales = products.reduce((sum, p) => sum + (p.totalSales || 0), 0);
  const totalRevenue = products.reduce((sum, p) => sum + (p.totalRevenue || 0), 0);
  
  return {
    products,
    totalClicks,
    totalSales,
    totalRevenue,
    conversionRate: totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(2) : 0,
  };
}

/**
 * Search products
 */
export async function searchProducts(db, searchTerm, category = null) {
  const productsRef = collection(db, "products");
  let q;
  
  if (category) {
    q = query(
      productsRef,
      where("category", "==", category),
      where("status", "==", "active")
    );
  } else {
    q = query(
      productsRef,
      where("status", "==", "active")
    );
  }
  
  const snapshot = await getDocs(q);
  let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filter by search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term) ||
      p.tags.some(tag => tag.toLowerCase().includes(term))
    );
  }
  
  return products;
}

/**
 * Get product categories
 */
export async function getProductCategories(db) {
  const productsRef = collection(db, "products");
  const q = query(productsRef, where("status", "==", "active"));
  
  const snapshot = await getDocs(q);
  const products = snapshot.docs.map(doc => doc.data());
  
  const categories = new Set();
  products.forEach(p => {
    if (p.category) categories.add(p.category);
  });
  
  return Array.from(categories);
}

/**
 * Remove product tag from post
 */
export async function removeProductTag(db, postId, productId) {
  const productTagsRef = collection(db, "product_tags");
  const q = query(
    productTagsRef,
    where("postId", "==", postId),
    where("productId", "==", productId)
  );
  
  const snapshot = await getDocs(q);
  snapshot.docs.forEach(doc => {
    doc.ref.delete();
  });
}
