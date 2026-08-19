import { useRef, useState } from 'react';
import { Camera, ImagePlus, X, Loader2, AlertCircle } from 'lucide-react';
import {
  createPendingPhoto,
  validatePhotoFile,
  type PendingPhoto,
  ACCEPTED_EXTENSIONS,
  MAX_PHOTO_SIZE,
} from '@/services/photos';

interface PhotoUploaderProps {
  photos: PendingPhoto[];
  onAdd: (photo: PendingPhoto) => void;
  onRemove: (index: number) => void;
  uploading?: boolean;
}

export function PhotoUploader({ photos, onAdd, onRemove, uploading }: PhotoUploaderProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    for (const file of Array.from(files)) {
      const validationError = validatePhotoFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      onAdd(createPendingPhoto(file));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-slate-700">
          Photos <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <span className="text-xs text-slate-400">
          Max 10 MB each
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-5 px-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera className="h-6 w-6 text-slate-400" aria-hidden />
          <span>Take Photo</span>
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-5 px-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImagePlus className="h-6 w-6 text-slate-400" aria-hidden />
          <span>Add from Gallery</span>
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photos.map((photo, index) => (
              <div
                key={index}
                className="relative group aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200 bg-slate-100"
              >
                <img
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  className="h-full w-full object-cover"
                />
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-slate-900/70 text-white flex items-center justify-center transition hover:bg-slate-900"
                    aria-label={`Remove ${photo.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} ready to upload.
          </p>
        </div>
      )}
    </div>
  );
}
