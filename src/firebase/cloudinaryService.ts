import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  enabled: boolean;
}

const SETTINGS_COLLECTION = 'settings';
const CLOUDINARY_DOC = 'cloudinary';

// Cache in memory to avoid repetitive Firestore reads during a session
let cachedConfig: CloudinaryConfig | null = null;

/**
 * Fetch Cloudinary configurations from Firestore.
 * Falls back to environment variables if not set in database.
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
    // Wrap with short 1000ms timeout for ultra-fast fallback
    const snap = await Promise.race([
      getDoc(docRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
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
    console.warn('Error reading Cloudinary config from Firestore, using env fallbacks:', err);
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
 * If Cloudinary is disabled, unconfigured, or the upload fails, it throws an error to prevent saving Base64 in Firestore.
 */
export async function uploadImageToCloudinary(imageSource: string | File): Promise<string> {
  if (!imageSource) return '';

  // If it's already an external HTTP/HTTPS URL (e.g. from existing uploads or CDN), return it directly!
  if (typeof imageSource === 'string' && (imageSource.startsWith('https://') || imageSource.startsWith('http://'))) {
    return imageSource;
  }

  try {
    const config = await getCloudinaryConfig();
    const cloudName = config.cloudName || 'iffzqdhi';
    const uploadPreset = config.uploadPreset || 'alimedia_uploads';

    const formData = new FormData();
    formData.append('file', imageSource);
    formData.append('upload_preset', uploadPreset);

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    
    // Add 25-second timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudinary responded with status ${response.status}: ${errText}`);
    }

    const result = await response.json();
    if (result.secure_url) {
      return result.secure_url;
    } else if (result.url) {
      return result.url;
    }

    throw new Error('Cloudinary response did not contain secure_url or url');
  } catch (err: any) {
    console.error('Cloudinary upload error:', err);
    throw new Error(err.message || 'Unknown Cloudinary error during photo upload.');
  }
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
