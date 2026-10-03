type CheckInPhoto = {
  blob: Blob;
  previewUrl: string;
};

let currentPhoto: CheckInPhoto | null = null;

export function setCheckInPhoto(blob: Blob) {
  clearCheckInPhoto();
  currentPhoto = {
    blob,
    previewUrl: URL.createObjectURL(blob),
  };
}

export function getCheckInPhoto() {
  return currentPhoto;
}

/** Restore a blob (e.g. from a saved draft) without clearing it first. */
export function setCheckInPhotoBlob(blob: Blob) {
  if (currentPhoto) URL.revokeObjectURL(currentPhoto.previewUrl);
  currentPhoto = {
    blob,
    previewUrl: URL.createObjectURL(blob),
  };
}

export function clearCheckInPhoto() {
  if (currentPhoto) URL.revokeObjectURL(currentPhoto.previewUrl);
  currentPhoto = null;
}
