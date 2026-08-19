import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/contexts/ToastContext';
import {
  fetchWorkOrderPhotos,
  getPhotoSignedUrl,
  deleteWorkOrderPhoto,
} from '@/services/photos';
import { canCompleteWorkOrder } from '@/utils/permissions';
import type { WorkOrderPhoto } from '@/types';

interface PhotoGalleryProps {
  workOrderId: string;
}

export function PhotoGallery({ workOrderId }: PhotoGalleryProps) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const mayDelete = canCompleteWorkOrder(profile?.role ?? null);

  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchWorkOrderPhotos(workOrderId)
      .then((data) => {
        if (!active) return;
        setPhotos(data);
      })
      .catch((err: unknown) => {
        console.error('Failed to load photos:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workOrderId]);

  // Generate signed URLs for thumbnails.
  useEffect(() => {
    let active = true;
    const unprocessed = photos.filter((p) => !signedUrls[p.id]);
    if (unprocessed.length === 0) return;

    Promise.all(
      unprocessed.map(async (p) => {
        const url = await getPhotoSignedUrl(p, 3600);
        return { id: p.id, url };
      }),
    ).then((results) => {
      if (!active) return;
      setSignedUrls((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.url) next[r.id] = r.url;
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [photos, signedUrls]);

  const openLightbox = useCallback(
    async (index: number) => {
      setLightboxIndex(index);
      const photo = photos[index];
      if (photo && !fullUrls[photo.id]) {
        const url = await getPhotoSignedUrl(photo, 3600);
        if (url) {
          setFullUrls((prev) => ({ ...prev, [photo.id]: url }));
        }
      }
    },
    [photos, fullUrls],
  );

  // Preload adjacent full-size images.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const preload = [lightboxIndex - 1, lightboxIndex + 1];
    for (const i of preload) {
      if (i >= 0 && i < photos.length) {
        const photo = photos[i];
        if (photo && !fullUrls[photo.id]) {
          getPhotoSignedUrl(photo, 3600).then((url) => {
            if (url) {
              setFullUrls((prev) => ({ ...prev, [photo.id]: url }));
            }
          });
        }
      }
    }
  }, [lightboxIndex, photos, fullUrls]);

  // Keyboard navigation in lightbox.
  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowLeft')
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      else if (e.key === 'ArrowRight')
        setLightboxIndex((prev) =>
          prev !== null && prev < photos.length - 1 ? prev + 1 : prev,
        );
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, photos.length]);

  async function handleDelete(photo: WorkOrderPhoto) {
    setDeleting(photo.id);
    try {
      await deleteWorkOrderPhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      showToast('Photo removed.', 'success');
    } catch (err) {
      console.error('Delete photo failed:', err);
      showToast('Could not remove the photo.', 'error');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return null;
  if (photos.length === 0) return null;

  return (
    <>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Photos ({photos.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative group aspect-square rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-100"
            >
              {signedUrls[photo.id] ? (
                <button
                  onClick={() => openLightbox(index)}
                  className="h-full w-full block"
                  aria-label={`View photo ${index + 1}`}
                >
                  <img
                    src={signedUrls[photo.id]}
                    alt={photo.file_name ?? `Photo ${index + 1}`}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                </div>
              )}
              {mayDelete && (
                <button
                  onClick={() => handleDelete(photo)}
                  disabled={deleting === photo.id}
                  className="absolute top-1.5 right-1.5 h-8 w-8 rounded-lg bg-slate-900/70 text-white flex items-center justify-center transition hover:bg-red-600 opacity-0 group-hover:opacity-100 disabled:opacity-70"
                  aria-label="Delete photo"
                >
                  {deleting === photo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photo={photos[lightboxIndex]}
          url={fullUrls[photos[lightboxIndex].id]}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < photos.length - 1}
          index={lightboxIndex}
          total={photos.length}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => openLightbox(Math.max(0, lightboxIndex - 1))}
          onNext={() => openLightbox(Math.min(photos.length - 1, lightboxIndex + 1))}
        />
      )}
    </>
  );
}

interface LightboxProps {
  photo: WorkOrderPhoto;
  url: string | undefined;
  hasPrev: boolean;
  hasNext: boolean;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function Lightbox({ photo, url, hasPrev, hasNext, index, total, onClose, onPrev, onNext }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <span className="text-sm text-slate-300 truncate max-w-[60vw]">
          {photo.file_name ?? `Photo ${index + 1}`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{index + 1} / {total}</span>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-lg hover:bg-white/10 flex items-center justify-center transition"
            aria-label="Close photo viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center px-4 pb-4 relative min-h-0"
        onClick={onClose}
      >
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-2 sm:left-4 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-10"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {url ? (
          <img
            src={url}
            alt={photo.file_name ?? `Photo ${index + 1}`}
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Loading photo…</span>
          </div>
        )}

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-2 sm:right-4 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-10"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
