import { supabase } from '@/lib/supabase';
import type { WorkOrderPhoto } from '@/types';

export const PHOTO_BUCKET = 'work-order-photos';
export const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.heic,.heif';

export interface PendingPhoto {
  file: File;
  previewUrl: string;
}

export function validatePhotoFile(file: File): string | null {
  if (file.size > MAX_PHOTO_SIZE) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`;
  }
  const type = file.type.toLowerCase();
  if (type && !ACCEPTED_IMAGE_TYPES.includes(type)) {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      return `${file.name} is not an image. Only JPG, PNG, and WebP photos are allowed.`;
    }
  }
  return null;
}

export function createPendingPhoto(file: File): PendingPhoto {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export async function uploadWorkOrderPhotos(
  workOrderId: string,
  photos: PendingPhoto[],
): Promise<WorkOrderPhoto[]> {
  const results: WorkOrderPhoto[] = [];
  for (const photo of photos) {
    const ext = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const storagePath = `${workOrderId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, photo.file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Photo upload failed:', uploadError.message);
      throw new Error(`Could not upload ${photo.file.name}: ${uploadError.message}`);
    }

    const { data, error } = await supabase
      .from('work_order_photos')
      .insert({
        work_order_id: workOrderId,
        storage_path: storagePath,
        file_name: photo.file.name,
        file_size: photo.file.size,
        mime_type: photo.file.type || null,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error('Photo record insert failed:', error?.message);
      throw new Error(`Could not save photo record for ${photo.file.name}.`);
    }
    results.push(data as WorkOrderPhoto);
  }
  return results;
}

export async function fetchWorkOrderPhotos(workOrderId: string): Promise<WorkOrderPhoto[]> {
  const { data, error } = await supabase
    .from('work_order_photos')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorkOrderPhoto[];
}

export async function deleteWorkOrderPhoto(photo: WorkOrderPhoto): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([photo.storage_path]);

  if (storageError) {
    console.error('Storage delete failed:', storageError.message);
  }

  const { error } = await supabase
    .from('work_order_photos')
    .delete()
    .eq('id', photo.id);

  if (error) throw error;
}

export async function getPhotoSignedUrl(photo: WorkOrderPhoto, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(photo.storage_path, expiresIn);

  if (error) {
    console.error('Signed URL failed:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
