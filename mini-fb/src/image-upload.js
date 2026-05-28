// Free image upload using imgbb API (no Firebase Storage required)
// imgbb offers free hosting with generous limits

const IMGBB_API_KEY = "ff9881bca38d9ff39e53033360d2b6ec";

export async function compressImage(file, maxWidth = 1920, quality = 0.8) {
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
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || "Upload failed");
    }

    return {
      url: data.data.url,
      deleteUrl: data.data.delete_url,
      mediaType: "image",
    };
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
}

export async function uploadVideoToAlternative(file) {
  // For videos, we'll use a different approach
  // Since most free services have limitations, we'll use a simple approach
  // In production, you could use services like:
  // - Cloudinary (free tier)
  // - Streamable
  // - Or self-hosted solution
  
  // For now, we'll use a temporary solution: convert video to base64 and store as data URL
  // This is not recommended for production due to size limits
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

export async function uploadMedia(file) {
  if (file.type.startsWith("image/")) {
    return await uploadImageToImgbb(file);
  } else if (file.type.startsWith("video/")) {
    return await uploadVideoToAlternative(file);
  } else {
    throw new Error("Unsupported file type. Please upload images only.");
  }
}
