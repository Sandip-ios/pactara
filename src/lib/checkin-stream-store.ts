let currentStream: MediaStream | null = null;

export function setCheckInStream(stream: MediaStream | null) {
  if (currentStream && currentStream !== stream) {
    currentStream.getTracks().forEach((t) => t.stop());
  }
  currentStream = stream;
}

export function takeCheckInStream(): MediaStream | null {
  const s = currentStream;
  currentStream = null;
  return s;
}

export function clearCheckInStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
}
