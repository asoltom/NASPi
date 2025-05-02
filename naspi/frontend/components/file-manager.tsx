'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, PlusCircle, Pause, Play, X } from 'lucide-react';
import { useUploadStore } from '../data/uploadStore';

interface NotificationProps {
  message: string;
  type: "success" | "error";
}

interface FileItem {
  name: string;
  isFolder: boolean;
}

const Notification: React.FC<NotificationProps> = ({ message, type }) => (
  <div className={`fixed top-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white text-sm
    ${type === "success" ? "bg-green-500" : "bg-red-500"}`}>
    {message}
  </div>
);

export default function FileManager() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [notification, setNotification] = useState<NotificationProps | null>(null);

  const {
    uploading,
    uploadingFileName,
    uploadProgress,
    paused,
    cancelled,
    setUploading,
    setUploadingFileName,
    setUploadProgress,
    setPaused,
    setCancelled,
    pauseUpload,
    resumeUpload,
    cancelUpload
  } = useUploadStore();

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchFiles = async (path: string = '') => {
    try {
      const res = await fetch(`http://naspi.local:5000/api/files?path=${path}`);
      const data = await res.json();
      const sorted = [
        ...data.folders.map((f: string) => ({ name: f, isFolder: true })),
        ...data.files.map((f: string) => ({ name: f, isFolder: false })),
      ].sort((a, b) => a.name.localeCompare(b.name));
      setFiles(sorted);
      setCurrentPath(path);
    } catch (err: any) {
      console.error("Error cargando archivos:", err.message);
      showNotification("Error cargando archivos", "error");
      setFiles([]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const filesArray = Array.from(fileList);
    setUploading(true);
    resumeUpload();  // en vez de setPaused(false)
    setCancelled(false); // este sí puedes dejarlo si quieres limpiar
    setUploadProgress(0);
    setUploadingFileName(null);

    for (const file of filesArray) {
      setUploadingFileName(file.name);
      try {
        await uploadFileInChunks(file);
        if (!cancelled) showNotification(`"${file.name}" subido con éxito`, "success");
      } catch (err: any) {
        if (err.message === 'Upload cancelled') {
          showNotification(`Subida cancelada para "${file.name}"`, "error");
        } else {
          showNotification(`Error al subir "${file.name}"`, "error");
        }
        console.error(err);
      }
      if (cancelled) break;
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadingFileName(null);
    fetchFiles(currentPath);
    e.target.value = '';
  };

  const uploadFileInChunks = async (file: File) => {
    const chunkSize = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let index = 0; index < totalChunks; index++) {
      if (useUploadStore.getState().cancelled) {
        await fetch("http://naspi.local:5000/api/cancel_upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, path: currentPath }),
        });
        throw new Error("Upload cancelled");
      }

      while (useUploadStore.getState().paused) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("chunk", chunk);
      formData.append("filename", file.name);
      formData.append("chunkIndex", index.toString());
      formData.append("totalChunks", totalChunks.toString());
      formData.append("path", currentPath || '');

      const response = await fetch("http://naspi.local:5000/api/upload_chunk", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Chunk ${index + 1} failed`);
      }

      setUploadProgress(Math.round(((index + 1) / totalChunks) * 100));
    }
  };

  const handleDownload = async (fileName: string) => {
    const encoded = encodeURIComponent(currentPath ? `${currentPath}/${fileName}` : fileName);
    const res = await fetch(`http://naspi.local:5000/api/files/${encoded}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (fileName: string) => {
    const encoded = encodeURIComponent(currentPath ? `${currentPath}/${fileName}` : fileName);
    const res = await fetch(`http://naspi.local:5000/api/files/${encoded}`, { method: "DELETE" });
    const data = await res.json();
    showNotification(data.message || "Archivo eliminado", res.ok ? "success" : "error");
    fetchFiles(currentPath);
  };

  const createFolder = async () => {
    const name = prompt("Nombre de la nueva carpeta:");
    if (!name) return;
    const res = await fetch(`http://naspi.local:5000/api/create_folder`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_name: name, current_path: currentPath }),
    });
    const data = await res.json();
    showNotification(data.message, res.ok ? "success" : "error");
    fetchFiles(currentPath);
  };

  const handleEnterFolder = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    fetchFiles(newPath);
  };

  const handleGoBack = () => {
    const parts = currentPath.split("/");
    parts.pop();
    fetchFiles(parts.join("/"));
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="p-4 space-y-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      {notification && <Notification message={notification.message} type={notification.type} />}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">File Manager</h1>
        <div className="space-x-2">
          <Button onClick={() => setViewMode("grid")} variant={viewMode === 'grid' ? 'secondary' : 'outline'}><Grid className="w-4 h-4" /></Button>
          <Button onClick={() => setViewMode("list")} variant={viewMode === 'list' ? 'secondary' : 'outline'}><List className="w-4 h-4" /></Button>
          <Button onClick={createFolder}><PlusCircle className="w-4 h-4 mr-2" /> Crear Carpeta</Button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Input type="file" multiple onChange={handleFileChange} className="hidden" id="fileUpload" />
        <label htmlFor="fileUpload" className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center shadow">
          <Upload className="w-5 h-5 mr-2" /> Subir archivos
        </label>
      </div>

      {uploading && (
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Subiendo: <strong>{uploadingFileName}</strong> ({uploadProgress}%)
          </p>
          <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="flex gap-2 mt-2">
            {!paused ? (
              <Button size="sm" onClick={pauseUpload}>
                <Pause className="w-4 h-4 mr-1" /> Pausar
              </Button>
            ) : (
              <Button size="sm" onClick={resumeUpload}>
                <Play className="w-4 h-4 mr-1" /> Reanudar
              </Button>
            )}
            <Button size="sm" onClick={cancelUpload} variant="destructive">
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      <Card className="bg-white dark:bg-gray-800 shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Archivos y Carpetas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-2">
            {currentPath && <Button onClick={handleGoBack} variant="outline" size="sm">⬅ Volver</Button>}
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-300 truncate">{currentPath || 'Raíz'}</span>
          </div>
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4' : 'grid-cols-1 gap-2'}`}>
            {files.map((item, index) => (
              <div key={index} className="p-4 border rounded dark:border-gray-700 bg-gray-50 dark:bg-gray-900 cursor-pointer"
                onClick={() => item.isFolder ? handleEnterFolder(item.name) : null}>
                {item.isFolder ? (
                  <Folder className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-300 mx-auto" />
                ) : (
                  <File className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-300 mx-auto" />
                )}
                <p className="truncate text-center text-sm text-gray-800 dark:text-gray-200">{item.name}</p>
                {!item.isFolder && (
                  <div className="flex justify-center mt-2 space-x-2">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }}><Download className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(item.name); }}><Trash className="w-4 h-4 text-red-500" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {files.length === 0 && !uploading && <p className="text-center text-gray-500 dark:text-gray-400 mt-4">No hay archivos ni carpetas.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
