const MAX_SIZE_KB = 100;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1600;

/**
 * Compress an image file client-side using canvas.
 * Targets ~100KB output by progressively reducing quality.
 */
export async function compressImage(file: File): Promise<File> {
  // Skip compression for already small files
  if (file.size <= MAX_SIZE_KB * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Failed to get canvas 2D context"));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width = (width * MAX_HEIGHT) / height;
        height = MAX_HEIGHT;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Progressive quality reduction until we hit target size
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Compression failed"));
              return;
            }

            if (blob.size > MAX_SIZE_KB * 1024 && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, ".jpg"),
                { type: "image/jpeg" }
              );
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          quality
        );
      };
      
      tryCompress();

      // Cleanup
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

