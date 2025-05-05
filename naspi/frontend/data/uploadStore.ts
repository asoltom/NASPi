// En tu archivo uploadStore.ts (o como se llame)
import { create } from 'zustand';

interface UploadStatus {
  fileName: string;
  progress: number;
}

interface UploadState {
  uploading: boolean;
  paused: boolean;
  cancelled: boolean;
  uploadQueue: UploadStatus[]; // <-- Añadido
  setUploading: (uploading: boolean) => void;
  setPaused: (paused: boolean) => void;
  setCancelled: (cancelled: boolean) => void;
  pauseUpload: () => void;
  resumeUpload: () => void;
  cancelUpload: () => void;
  // --- Nuevas Acciones ---
  setUploadQueue: (queue: UploadStatus[]) => void;
  addFileToQueue: (fileName: string) => void;
  updateFileProgress: (fileName: string, progress: number) => void;
  removeFileFromQueue: (fileName: string) => void;
  resetUploadState: () => void; // Útil para limpiar todo
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploading: false,
  paused: false,
  cancelled: false,
  uploadQueue: [], // <-- Inicializado
  setUploading: (uploading) => set({ uploading }),
  setPaused: (paused) => set({ paused }),
  setCancelled: (cancelled) => set({ cancelled }),
  pauseUpload: () => set({ paused: true }),
  resumeUpload: () => set({ paused: false }),
  cancelUpload: () => {
    console.log("Cancel action triggered in store"); // Debug log
    set({ cancelled: true, paused: false }); // Asegura que no esté pausado si cancela
  },
  // --- Implementación Nuevas Acciones ---
  setUploadQueue: (queue) => set({ uploadQueue: queue }),
  addFileToQueue: (fileName) => set((state) => ({
    uploadQueue: [...state.uploadQueue, { fileName, progress: 0 }]
  })),
  updateFileProgress: (fileName, progress) => set((state) => ({
    uploadQueue: state.uploadQueue.map(f =>
      f.fileName === fileName ? { ...f, progress } : f
    )
  })),
  removeFileFromQueue: (fileName) => set((state) => ({
    uploadQueue: state.uploadQueue.filter(f => f.fileName !== fileName)
  })),
  resetUploadState: () => set({
      uploading: false,
      paused: false,
      cancelled: false,
      uploadQueue: []
  }),
}));