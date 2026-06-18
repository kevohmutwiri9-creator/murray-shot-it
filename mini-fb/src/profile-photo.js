import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { compressImage, uploadImageToImgbb } from "./image-upload.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

/**
 * Upload and update user's profile photo
 * @param {Firebase} firebaseApp - Firebase app instance
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} - New photo URL
 */
export async function uploadProfilePhoto(firebaseApp, file) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in");
  if (!file) throw new Error("No file provided");

  // Validate file type
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file");
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error("Image must be less than 5MB");
  }

  const db = getDbService(firebaseApp);

  // Compress image before upload
  const compressed = await compressImage(file, 800, 0.9);

  // Upload to imgbb
  const result = await uploadImageToImgbb(compressed);
  const photoUrl = result.data.url;

  // Update user profile in Firestore
  await updateDoc(doc(db, "profiles", user.uid), {
    photoUrl,
    updatedAt: new Date(),
  });

  return photoUrl;
}

/**
 * Update user's profile fields
 * @param {Firebase} firebaseApp - Firebase app instance
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateProfileFields(firebaseApp, updates) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not logged in");

  const db = getDbService(firebaseApp);
  const profileRef = doc(db, "profiles", user.uid);

  // Add updatedAt timestamp
  const dataToUpdate = {
    ...updates,
    updatedAt: new Date(),
  };

  await updateDoc(profileRef, dataToUpdate);
}

/**
 * Prompt user to upload a profile photo
 * @param {Firebase} firebaseApp - Firebase app instance
 * @param {Function} onSuccess - Callback on successful upload
 * @param {Function} onError - Callback on error
 */
export function promptProfilePhotoUpload(firebaseApp, onSuccess, onError) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const photoUrl = await uploadProfilePhoto(firebaseApp, file);
      onSuccess(photoUrl);
    } catch (error) {
      onError(error);
    }
  });

  input.click();
}

/**
 * Get profile display info with photo
 * @param {Object} profile - Profile data from Firestore
 * @param {string} email - User email
 * @returns {Object} - Display info with photo
 */
export function getProfileDisplay(profile, email) {
  const displayName = profile?.displayName || email.split("@")[0];
  const photoUrl = profile?.photoUrl || null;
  const initial = displayName.charAt(0).toUpperCase();

  return {
    displayName,
    photoUrl,
    initial,
    isPhotoSet: !!photoUrl,
  };
}
