'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, PlusCircle, Pause, Play, X } from 'lucide-react';
import { useUploadStore } from '../data/uploadStore';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"

interface NotificationProps {
  message: string;
  type: "success" | "error";
}

interface FileItem {
  name: string;
  isFolder: boolean;
}

// Interface UploadStatus ya definida en uploadStore.ts

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string | null>(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // --- Obteniendo estado y acciones del Store ---
  const {
    uploading,
    paused,
    cancelled,
    uploadQueue,
    globalProgress,
    setUploading,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    addFileToQueue,
    updateFileProgress,
    removeFileFromQueue,
    resetUploadState
  } = useUploadStore();

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- fetchFiles ahora usa useCallback para evitar re-creaciones innecesarias ---
  const fetchFiles = useCallback(async (path: string = '') => {
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`); // Encode path
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); // Check response status
      const data = await res.json();
      const sorted = [
        ...(data.folders?.map((f: string) => ({ name: f, isFolder: true })) || []), // Safety checks
        ...(data.files?.map((f: string) => ({ name: f, isFolder: false })) || []), // Safety checks
      ].sort((a, b) => a.name.localeCompare(b.name));
      setFiles(sorted);
      setCurrentPath(path);
    } catch (err: any) {
      console.error("Error cargando archivos:", err.message);
      showNotification("Error cargando archivos", "error");
      setFiles([]);
    }
  }, [/* Dependencias vacías si showNotification no cambia, o añadir showNotification */]); // Ajustar dependencias si es necesario


  // --- uploadFileInChunks ahora usa acciones del store ---
  const uploadFileInChunks = useCallback(async (file: File, path: string) => {
    const chunkSize = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let index = 0; index < totalChunks; index++) {
      // Lee el estado directamente del store para la comprobación más actualizada
      if (useUploadStore.getState().cancelled) {
        console.log(`Cancellation check triggered for ${file.name}`); // Debug log
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
      formData.append("path", path || '');

      try {
        const response = await fetch("/api/upload_chunk", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.text(); // Get more error details
          console.error("Chunk upload failed:", errorData);
          throw new Error(`Chunk ${index + 1} failed. Status: ${response.status}`);
        }

        const currentProgress = Math.round(((index + 1) / totalChunks) * 100);
        // --- Usa la acción del store para actualizar el progreso ---
        updateFileProgress(file.name, currentProgress);

      } catch (error) {
        console.error(`Error uploading chunk ${index + 1} for ${file.name}:`, error);
        throw error;
      }
    }
  }, [updateFileProgress]); // Dependencia de la acción del store


  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const currentUploadPath = currentPath; // Captura el path actual al iniciar la subida

    // Resetea cancelado/pausado (si aplica), añade ficheros a la cola y marca como subiendo
    resumeUpload(); // Asegura que no esté pausado
    useUploadStore.setState({ cancelled: false }); // Resetea cancelación explícitamente
    filesArray.forEach(file => addFileToQueue(file.name));
    setUploading(true);


    for (const file of filesArray) {
      // Comprueba si se canceló *antes* de empezar a subir este fichero
      if (useUploadStore.getState().cancelled) {
        showNotification(`Subida cancelada antes de empezar para "${file.name}"`, "error");
        removeFileFromQueue(file.name); // Quita de la cola si no se inició
        continue; // Salta al siguiente fichero
      }

      try {
        await uploadFileInChunks(file, currentUploadPath); // Pasa el path capturado
        // Si no está cancelado *después* de subir, muestra éxito
        if (!useUploadStore.getState().cancelled) {
          showNotification(`"${file.name}" subido con éxito`, "success");
        }
        // Siempre se quita de la cola al terminar (éxito o error gestionado abajo)
        // excepto si fue cancelado globalmente durante la subida de este fichero
        if (!useUploadStore.getState().cancelled) {
          removeFileFromQueue(file.name);
        }

      } catch (err: any) {
        // Si el error es por cancelación (lanzado desde uploadFileInChunks)
        if (err.message === 'Upload cancelled') {
          showNotification(`Subida cancelada para "${file.name}"`, "error");
          // No quitamos de la cola aquí, se quitarán todos al final si hay cancelación
        } else {
          // Otro tipo de error durante la subida
          showNotification(`Error al subir "${file.name}": ${err.message}`, "error");
          console.error(`Upload error for ${file.name}:`, err);
          // Quita el fichero fallido de la cola si no hubo cancelación global
          if (!useUploadStore.getState().cancelled) {
            removeFileFromQueue(file.name);
          }
        }
      }

      // Si se canceló *durante* la subida de este fichero o los anteriores, sal del bucle
      if (useUploadStore.getState().cancelled) {
        console.log("Breaking upload loop due to cancellation"); // Debug log
        break;
      }
    }

    // --- Limpieza final ---
    // Si hubo una cancelación, limpia toda la cola restante
    if (useUploadStore.getState().cancelled) {
      console.log("Clearing queue due to cancellation"); // Debug log
      // Obtiene los nombres de los archivos que quedan en la cola para quitarlos
      const remainingFiles = useUploadStore.getState().uploadQueue.map(f => f.fileName);
      remainingFiles.forEach(name => removeFileFromQueue(name));
      showNotification("Subida cancelada por el usuario", "error");
    }

    // Desactiva 'uploading' solo si la cola está vacía después de todo el proceso
    // Hacemos esto en un micro-timeout para asegurar que el estado de la cola se actualizó
    setTimeout(() => {
      if (useUploadStore.getState().uploadQueue.length === 0) {
        setUploading(false);
      }
      // Refresca la lista de archivos *solo si no hubo cancelación* (o siempre, según preferencia)
      if (!useUploadStore.getState().cancelled) {
        fetchFiles(currentUploadPath);
      }
    }, 0);


    // Limpia el input para permitir subir el mismo archivo de nuevo
    if (e.target) {
      e.target.value = '';
    }
  }, [currentPath, resumeUpload, addFileToQueue, setUploading, uploadFileInChunks, showNotification, removeFileFromQueue, fetchFiles]);

  const createFolder = useCallback(async (name: string) => {
    if (!name || !/^[a-zA-Z0-9_-\s]+$/.test(name)) {
      showNotification("Nombre de carpeta inválido.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/create_folder`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_name: name, current_path: currentPath }),
      });
      const data = await res.json();
      showNotification(data.message || (res.ok ? "Carpeta creada" : "Error al crear carpeta"), res.ok ? "success" : "error");
      if (res.ok) fetchFiles(currentPath);
    } catch (error: any) {
      showNotification("Error de red al crear carpeta", "error");
      console.error("Create folder error:", error);
    }
  }, [currentPath, fetchFiles, showNotification]);

  const handleDeleteFolder = useCallback(async () => {
    if (!currentPath) {
      showNotification("No puedes eliminar la carpeta raíz", "error");
      return;
    }
    const currentFolderName = currentPath.split('/').pop() || 'esta carpeta';

    try {
      const encodedPath = encodeURIComponent(currentPath);
      const response = await fetch(`/api/folders/${encodedPath}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({})); // Intenta parsear JSON, si no, objeto vacío

      if (response.ok) {
        showNotification(`Carpeta "${currentFolderName}" eliminada correctamente`, "success");
        const parentPath = currentPath.split('/').slice(0, -1).join('/');
        fetchFiles(parentPath); // Vuelve y refresca
      } else {
        showNotification(`Error al eliminar "${currentFolderName}": ${data.error || response.statusText}`, "error");
        console.error("Error al eliminar carpeta:", data.error || response.statusText);
        fetchFiles(currentPath); // Opcional: Refrescar incluso en error
      }
    } catch (error: any) {
      showNotification(`Error de red al eliminar la carpeta "${currentFolderName}"`, "error");
      console.error("Error en DELETE folder:", error);
      fetchFiles(currentPath); // Opcional: Refrescar incluso en error
    }
  }, [currentPath, fetchFiles /* , showNotification */]); // Añadir showNotification si su referencia puede cambiar

  const handleDownload = useCallback(async (fileName: string) => {
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const encoded = encodeURIComponent(fullPath);
    try {
      const res = await fetch(`/api/files/${encoded}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errorData.message || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link); // Necesario en algunos navegadores
      link.click();
      document.body.removeChild(link); // Limpiar
      URL.revokeObjectURL(url);
    } catch (error: any) {
      showNotification(`Error al descargar "${fileName}": ${error.message}`, "error");
      console.error("Download error:", error);
    }
  }, [currentPath /* , showNotification */]); // Añadir showNotification si su referencia puede cambiar

  const handleDelete = useCallback(async (fileName: string) => {
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;

    try {
      const encoded = encodeURIComponent(fullPath);
      const res = await fetch(`/api/files/${encoded}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({})); // Handle non-json responses gracefully
      showNotification(
        data.message || (res.ok ? "Archivo eliminado" : "Error al eliminar"),
        res.ok ? "success" : "error"
      );
      if (res.ok) fetchFiles(currentPath); // Refresh on success
    } catch (error: any) {
      showNotification(`Error de red al eliminar "${fileName}"`, "error");
      console.error("Delete file error:", error);
    }
  }, [currentPath, fetchFiles, showNotification]);

  const handleEnterFolder = useCallback((folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    fetchFiles(newPath);
  }, [currentPath, fetchFiles]);

  const handleGoBack = useCallback(() => {
    const parts = currentPath.split("/");
    parts.pop();
    fetchFiles(parts.join("/"));
  }, [currentPath, fetchFiles]);

  // --- Efecto inicial para cargar archivos ---
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // --- Renderizado ---
  return (
    <div className="p-4 space-y-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
      {notification && <Notification message={notification.message} type={notification.type} />}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">File Manager</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Botones de Vista */}
          <Button onClick={() => setViewMode("grid")} variant={viewMode === 'grid' ? 'secondary' : 'outline'} size="sm"><Grid className="w-4 h-4" /></Button>
          <Button onClick={() => setViewMode("list")} variant={viewMode === 'list' ? 'secondary' : 'outline'} size="sm"><List className="w-4 h-4" /></Button>

          {/* Botones de Acción */}
          <Button size="sm" onClick={() => {
            setNewFolderName('');
            setShowCreateFolderDialog(true);
          }}>
            <PlusCircle className="w-4 h-4 mr-1" /> Crear Carpeta
          </Button>
          {currentPath && (
            <Button
              variant="destructive"
              onClick={() => {
                const folderName = currentPath.split('/').pop() || 'esta carpeta';
                setCurrentFolderName(folderName);
                setShowDeleteFolderDialog(true);
              }}
              size="sm"
            >
              <Trash className="w-4 h-4 mr-1" /> Eliminar Carpeta Actual
            </Button>
          )}
        </div>
      </div>

      {/* Input de subida */}
      <div className="flex items-center space-x-4">
        <Input type="file" multiple onChange={handleFileChange} className="hidden" id="fileUpload" disabled={uploading} /> {/* Deshabilitar input mientras sube */}
        <label htmlFor="fileUpload" className={`cursor-pointer px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center shadow ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Upload className="w-5 h-5 mr-2" /> Subir archivos
        </label>
      </div>

      {/* Sección de Progreso (usa estado del uploadStore) */}
      {uploading && uploadQueue.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-md font-semibold">
              Progreso de Subida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Subiendo {uploadQueue.length} archivo(s)... Global: {globalProgress}%
              </p>
              {/* Controles Pausa/Reanudar/Cancelar */}
              <div className="flex gap-2">
                {!paused ? (
                  <Button size="sm" onClick={pauseUpload} variant="outline">
                    <Pause className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={resumeUpload} variant="outline">
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                <Button size="sm" onClick={cancelUpload} variant="destructive">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* Barra de Progreso Global */}
            <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2.5 mb-3">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${globalProgress}%` }}></div>
            </div>

            {/* Detalles Individuales */}
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-blue-600 hover:underline">Ver detalles</summary>
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2"> {/* Scroll si hay muchos */}
                {uploadQueue.map((upload) => (
                  <div key={upload.fileName}>
                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{upload.fileName} ({upload.progress}%)</p>
                    <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${upload.progress}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      )}


      {/* Listado de Archivos */}
      <Card className="bg-white dark:bg-gray-800 shadow">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Archivos y Carpetas</CardTitle>
          <div className="flex items-center mt-2 text-sm text-gray-600 dark:text-gray-300">
            {currentPath && <Button onClick={handleGoBack} variant="ghost" size="sm" className="mr-2 p-1 h-auto"><span role="img" aria-label="back">⬅️</span> Volver</Button>}
            / <span className="ml-1 font-mono break-all">{currentPath || 'Raíz'}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4' : 'grid-cols-1 gap-2'}`}>
            {files.map((item) => ( // Usar item.name como key si es único
              <div key={item.name} className={`p-3 border rounded dark:border-gray-700 ${item.isFolder ? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50' : 'bg-gray-50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-900/50'} cursor-pointer flex flex-col items-center text-center group relative`}
                onClick={() => item.isFolder ? handleEnterFolder(item.name) : null}
                title={item.name} // Tooltip para nombres largos
              >
                {item.isFolder ? (
                  <Folder className="w-10 h-10 mb-2 text-blue-500 dark:text-blue-400" />
                ) : (
                  <File className="w-10 h-10 mb-2 text-gray-500 dark:text-gray-400" />
                )}
                <p className="w-full truncate text-sm text-gray-800 dark:text-gray-200 mb-1">{item.name}</p>
                {/* Acciones aparecen en hover en modo grid, siempre visibles en lista */}
                <div className={`flex justify-center space-x-1 ${viewMode === 'grid' ? 'absolute bottom-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200' : 'mt-1'}`}>
                  {!item.isFolder && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }} title="Descargar">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  {!item.isFolder && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToDelete(item.name);
                        setShowDeleteDialog(true);
                      }}
                      title="Eliminar"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {files.length === 0 && !uploading && <p className="text-center text-gray-500 dark:text-gray-400 mt-4">Esta carpeta está vacía.</p>}
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar archivo?</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar el archivo <strong>{fileToDelete}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (fileToDelete) {
                  handleDelete(fileToDelete);
                }
                setShowDeleteDialog(false);
                setFileToDelete(null);
              }}
            >
              Sí, eliminar
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteFolderDialog} onOpenChange={setShowDeleteFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar carpeta actual?</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar la carpeta <strong>{currentFolderName}</strong> y todo su contenido? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                handleDeleteFolder();
                setShowDeleteFolderDialog(false); // cerrar diálogo
              }}
            >
              Sí, eliminar
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteFolderDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nueva carpeta</DialogTitle>
            <DialogDescription>
              Introduce un nombre válido (letras, números, guiones o espacios).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              autoFocus
            />
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              onClick={() => {
                createFolder(newFolderName.trim());
                setShowCreateFolderDialog(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Crear
            </Button>
            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}