// frontend/data/uploadStore.ts

import { create } from 'zustand';

interface UploadState {
  uploading: boolean;
  uploadingFileName: string | null;
  uploadProgress: number;
  paused: boolean;
  cancelled: boolean;
  setUploading: (value: boolean) => void;
  setUploadingFileName: (name: string | null) => void;
  setUploadProgress: (progress: number) => void;
  pauseUpload: () => void;
  resumeUpload: () => void;
  cancelUpload: () => void;
  setPaused: (value: boolean) => void;
  setCancelled: (value: boolean) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  uploading: false,
  uploadingFileName: null,
  uploadProgress: 0,
  paused: false,
  cancelled: false,

  setUploading: (value) => set({ uploading: value }),
  setUploadingFileName: (name) => set({ uploadingFileName: name }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),

  pauseUpload: () => set({ paused: true }),
  resumeUpload: () => set({ paused: false }),
  cancelUpload: () => set({ cancelled: true }),

  setPaused: (value) => set({ paused: value }),
  setCancelled: (value) => set({ cancelled: value }),
}));
