export async function getCaptureStream(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "never" } as any,
      audio: false
    });
    return stream;
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      throw new Error("Capture cancelled by user.");
    }
    throw new Error(err.message || "Failed to start capture stream.");
  }
}

export function captureFrame(video: HTMLVideoElement): string {
  const MAX_WIDTH = 2048;
  
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    throw new Error("Media initialization failed: Frame buffer is empty.");
  }

  let targetWidth = video.videoWidth;
  let targetHeight = video.videoHeight;

  if (targetWidth > MAX_WIDTH) {
    const scale = MAX_WIDTH / targetWidth;
    targetWidth = MAX_WIDTH;
    targetHeight = Math.round(targetHeight * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not get canvas context");
  
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/** 
 * Legacy atomic capture for backward compatibility if needed, 
 * though we are moving to the Viewfinder pattern.
 */
export async function captureTab(): Promise<string> {
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;

  try {
    stream = await getCaptureStream();
    video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    
    await new Promise((resolve, reject) => {
      if (!video) return reject(new Error("Video system failure."));
      video.onplaying = () => setTimeout(resolve, 250);
      video.onerror = () => reject(new Error("Media pipeline failure."));
      video.play().catch(reject);
    });
    
    return captureFrame(video);
  } finally {
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (video) video.srcObject = null;
  }
}
