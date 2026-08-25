import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  enabled: boolean;
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

const SETTINGS_COLLECTION = 'settings';
const CLOUDINARY_DOC = 'cloudinary';

// Cache in memory to avoid repetitive Firestore reads during a session
let cachedConfig: CloudinaryConfig | null = null;

/**
 * Fetch Cloudinary configurations from Firestore.
 * Falls back to environment variables or user-provided defaults.
 */
export async function getCloudinaryConfig(): Promise<CloudinaryConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Fallback to environment variables or user-provided defaults
  const envCloudName = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME || 'iffzqdhi';
  const envUploadPreset = (import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET || 'alimedia_uploads';
  const envEnabled = (import.meta as any).env?.VITE_CLOUDINARY_ENABLED !== 'false';

  const defaultConf: CloudinaryConfig = {
    cloudName: envCloudName,
    uploadPreset: envUploadPreset,
    enabled: true,
  };

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CLOUDINARY_DOC);
    const snap = await Promise.race([
      getDoc(docRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
    ]);

    if (snap && typeof snap.exists === 'function' && snap.exists()) {
      const data = snap.data() as Partial<CloudinaryConfig>;
      cachedConfig = {
        cloudName: data.cloudName || defaultConf.cloudName,
        uploadPreset: data.uploadPreset || defaultConf.uploadPreset,
        enabled: typeof data.enabled === 'boolean' ? data.enabled : defaultConf.enabled,
      };
      return cachedConfig;
    }
  } catch (err) {
    console.warn('Error reading Cloudinary config from Firestore, using defaults:', err);
  }

  return defaultConf;
}

/**
 * Save Cloudinary configuration to Firestore and update cache.
 */
export async function saveCloudinaryConfig(config: CloudinaryConfig): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, CLOUDINARY_DOC);
    await setDoc(docRef, config);
    cachedConfig = config;
  } catch (err) {
    console.error('Error saving Cloudinary config to Firestore:', err);
    throw err;
  }
}

/**
 * Uploads a base64 image or a File object directly to Cloudinary using Unsigned Uploads.
 * Returns both secure_url and public_id.
 */
export async function uploadPhotoToCloudinary(imageSource: string | File): Promise<CloudinaryUploadResult> {
  if (!imageSource) {
    throw new Error('No image source provided for Cloudinary upload.');
  }

  // If it's already an external HTTP/HTTPS URL (e.g. from existing uploads or CDN), return it directly
  if (typeof imageSource === 'string' && (imageSource.startsWith('https://') || imageSource.startsWith('http://'))) {
    return {
      url: imageSource,
      publicId: '',
    };
  }

  const config = await getCloudinaryConfig();
  const cloudName = config.cloudName || 'iffzqdhi';
  const uploadPreset = config.uploadPreset || 'alimedia_uploads';

  console.log('[CLOUDINARY] Upload started to cloud:', cloudName, 'preset:', uploadPreset);

  const formData = new FormData();
  formData.append('file', imageSource);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'alimedia_uploads');

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // 30-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[CLOUDINARY] API Error Response:', response.status, errText);
      throw new Error(`Cloudinary error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const finalUrl = result.secure_url || result.url;
    const finalPublicId = result.public_id || '';

    if (!finalUrl || finalUrl.startsWith('data:')) {
      throw new Error('Cloudinary did not return a valid hosted image URL.');
    }

    console.log('[CLOUDINARY] Upload success:', { url: finalUrl, publicId: finalPublicId });
    return {
      url: finalUrl,
      publicId: finalPublicId,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Cloudinary upload timed out after 30 seconds. Please check your network.');
    }
    console.error('[CLOUDINARY] Upload error:', err);
    throw err;
  }
}

/**
 * Uploads an image to Cloudinary and returns only the URL string (for backwards compatibility).
 */
export async function uploadImageToCloudinary(imageSource: string | File): Promise<string> {
  const result = await uploadPhotoToCloudinary(imageSource);
  return result.url;
}

/**
 * Helper to convert a File object to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || '');
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
