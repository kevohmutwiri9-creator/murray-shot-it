// Free image upload using imgbb API (no Firebase Storage required)
// imgbb offers free hosting with generous limits

const IMGBB_API_KEY = "ff9881bca38d9ff39e53033360d2b6ec";

export async function compressImage(file, maxWidth = 2560, quality = 0.95) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
  });
}

export async function uploadImageToImgbb(file) {
  if (!file) {
    throw new Error("No file provided");
  }

  // Check file type
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported.");
  }

  // Compress image before upload
  let fileToUpload = file;
  try {
    fileToUpload = await compressImage(file);
  } catch (error) {
    console.warn("Image compression failed, uploading original:", error);
    fileToUpload = file;
  }

  // Check file size (imgbb free tier: 32MB max)
  if (fileToUpload.size > 32 * 1024 * 1024) {
    throw new Error("File too large. Maximum size is 32MB.");
  }

  const formData = new FormData();
  formData.append("image", fileToUpload);

  try {
    console.log("Starting image upload to imgbb...");
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });

    console.log("Imgbb response status:", response.status);
    const data = await response.json();
    console.log("Imgbb response data:", data);

    if (!data.success) {
      console.error("Imgbb upload failed:", data);
      throw new Error(data.error?.message || "Upload failed");
    }

    return {
      url: data.data.url,
      deleteUrl: data.data.delete_url,
      mediaType: "image",
    };
  } catch (error) {
    console.error("Image upload error:", error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
}

const MAX_VIDEO_BYTES = 800 * 1024; // ~800KB — safe for Firestore-adjacent storage patterns

export async function uploadVideoToAlternative(file) {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is too large (${Math.round(file.size / 1024)}KB). Max ${Math.round(MAX_VIDEO_BYTES / 1024)}KB for short clips, or use an image.`
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve({
        url: reader.result,
        mediaType: "video",
      });
    };
    reader.onerror = () => reject(new Error("Failed to read video file"));
  });
}

export async function uploadMedia(file, opts = {}) {
  if (file.type.startsWith("image/")) {
    return await uploadImageToImgbb(file);
  } else if (file.type.startsWith("video/")) {
    if (file.size <= MAX_VIDEO_BYTES) {
      return await uploadVideoToAlternative(file);
    }
    if (opts?.firebaseApp && opts?.uid) {
      const { uploadFileToStorage } = await import("./storage-upload.js");
      const result = await uploadFileToStorage(opts.firebaseApp, {
        uid: opts.uid,
        file,
        folder: "reels",
        onProgress: opts.onProgress,
      });
      return { url: result.url, mediaType: "video" };
    }
    throw new Error(
      `Video is too large (${Math.round(file.size / 1024)}KB). Please upload a shorter clip, or enable Firebase Storage uploads.`
    );
  } else {
    throw new Error("Unsupported file type. Please upload images only.");
  }
}
