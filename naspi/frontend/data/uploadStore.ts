import { create } from 'zustand';

interface UploadStatus {
  fileName: string;
  progress: number;
}

interface UploadState {
  uploading: boolean;
  paused: boolean;
  cancelled: boolean;
  uploadQueue: UploadStatus[];
  globalProgress: number;
  setUploading: (uploading: boolean) => void;
  setPaused: (paused: boolean) => void;
  setCancelled: (cancelled: boolean) => void;
  setGlobalProgress: (progress: number) => void;
  pauseUpload: () => void;
  resumeUpload: () => void;
  cancelUpload: () => void;
  setUploadQueue: (queue: UploadStatus[]) => void;
  addFileToQueue: (fileName: string) => void;
  updateFileProgress: (fileName: string, progress: number) => void;
  removeFileFromQueue: (fileName: string) => void;
  resetUploadState: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploading: false,
  paused: false,
  cancelled: false,
  uploadQueue: [],
  globalProgress: 0,

  setUploading: (uploading) => set({ uploading }),
  setPaused: (paused) => set({ paused }),
  setCancelled: (cancelled) => set({ cancelled }),
  setGlobalProgress: (progress) => set({ globalProgress: progress }),

  pauseUpload: () => set({ paused: true }),
  resumeUpload: () => set({ paused: false }),
  cancelUpload: () => {
    console.log("Cancel action triggered in store");
    set({ cancelled: true, paused: false });
  },

  setUploadQueue: (queue) => {
    set({ uploadQueue: queue });
    updateGlobalProgress(queue);
  },

  addFileToQueue: (fileName) => {
    const newQueue = [...get().uploadQueue, { fileName, progress: 0 }];
    set({ uploadQueue: newQueue });
    updateGlobalProgress(newQueue);
  },

  updateFileProgress: (fileName, progress) => {
    const updatedQueue = get().uploadQueue.map((f) =>
      f.fileName === fileName ? { ...f, progress } : f
    );
    set({ uploadQueue: updatedQueue });
    updateGlobalProgress(updatedQueue);
  },

  removeFileFromQueue: (fileName) => {
    const updatedQueue = get().uploadQueue.filter(f => f.fileName !== fileName);
    set({ uploadQueue: updatedQueue });
    updateGlobalProgress(updatedQueue);
  },

  resetUploadState: () => {
    set({
      uploading: false,
      paused: false,
      cancelled: false,
      uploadQueue: [],
      globalProgress: 0,
    });
  },
}));

// Helper para calcular el promedio
function updateGlobalProgress(queue: UploadStatus[]) {
  const total = queue.length;
  const avg = total === 0 ? 0 : Math.floor(queue.reduce((sum, f) => sum + f.progress, 0) / total);
  useUploadStore.setState({ globalProgress: avg });
}
