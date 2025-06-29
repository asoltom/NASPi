import { create } from 'zustand';

interface UploadStatus {
  fileName: string;
  progress: number;
}

interface UploadState {
  uploading: boolean;
  paused: boolean;
  cancelled: boolean;
  uploadQueue: UploadStatus[];      // Archivos que se están subiendo ahora
  uploadHistory: UploadStatus[];    // Todos los archivos que han comenzado a subirse (activos o ya subidos)
  globalProgress: number;

  // Estado general
  setUploading: (uploading: boolean) => void;
  setPaused: (paused: boolean) => void;
  setCancelled: (cancelled: boolean) => void;
  setGlobalProgress: (progress: number) => void;

  // Acciones
  pauseUpload: () => void;
  resumeUpload: () => void;
  cancelUpload: () => void;

  // Gestión de colas
  setUploadQueue: (queue: UploadStatus[]) => void;
  addFileToQueue: (fileName: string) => void;
  updateFileProgress: (fileName: string, progress: number) => void;
  removeFileFromQueue: (fileName: string) => void;

  // Reset general
  resetUploadState: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploading: false,
  paused: false,
  cancelled: false,
  uploadQueue: [],
  uploadHistory: [],
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
    updateGlobalProgress(get().uploadHistory); // sigue usando el historial completo
  },

  addFileToQueue: (fileName) => {
    const currentQueue = get().uploadQueue;
    const currentHistory = get().uploadHistory;
    const newQueue = [...currentQueue, { fileName, progress: 0 }];

    const alreadyInHistory = currentHistory.some(f => f.fileName === fileName);
    const newHistory = alreadyInHistory
      ? currentHistory
      : [...currentHistory, { fileName, progress: 0 }];

    set({ uploadQueue: newQueue, uploadHistory: newHistory });
    updateGlobalProgress(newHistory);
  },

  updateFileProgress: (fileName, progress) => {
    const update = (list: UploadStatus[]) =>
      list.map(f => (f.fileName === fileName ? { ...f, progress } : f));

    const updatedQueue = update(get().uploadQueue);
    const updatedHistory = update(get().uploadHistory);

    set({
      uploadQueue: updatedQueue,
      uploadHistory: updatedHistory,
    });

    updateGlobalProgress(updatedHistory);
  },

  removeFileFromQueue: (fileName) => {
    const updatedQueue = get().uploadQueue.filter(f => f.fileName !== fileName);
    set({ uploadQueue: updatedQueue });

    // ⚠️ No eliminamos de uploadHistory para conservar progreso
    // globalProgress no cambia aquí: se mantiene
  },

  resetUploadState: () => {
    set({
      uploading: false,
      paused: false,
      cancelled: false,
      uploadQueue: [],
      uploadHistory: [],
      globalProgress: 0,
    });
  },
}));

// 🔄 Cálculo del progreso global basado en uploadHistory
function updateGlobalProgress(history: UploadStatus[]) {
  const total = history.length;
  const avg = total === 0
    ? 0
    : Math.floor(history.reduce((sum, f) => sum + f.progress, 0) / total);
  useUploadStore.setState({ globalProgress: avg });
}
