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

export function clearCheckInPhoto() {
  if (currentPhoto) URL.revokeObjectURL(currentPhoto.previewUrl);
  currentPhoto = null;
}
