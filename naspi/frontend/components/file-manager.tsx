import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, PlusCircle } from 'lucide-react';

// Definir interfaces para tipado correcto
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
  const [uploadProgress, setUploadProgress] = useState<number>(0); // Estado para la barra de progreso
  const [uploading, setUploading] = useState<boolean>(false); // Estado para indicar que se está subiendo


  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchFiles = async (path: string = '') => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files?path=${path}`);
      const data: { folders: string[]; files: string[] } = await response.json();

      setFiles([
        ...data.folders.map((folder) => ({ name: folder, isFolder: true })),
        ...data.files.map((file) => ({ name: file, isFolder: false })),
      ]);
      setCurrentPath(path);
    } catch (error) {
      showNotification('Error cargando archivos', 'error');
    }
  };

  const handleEnterFolder = (folderName: string) => {
    setCurrentPath((prevPath) => {
      const newPath = prevPath ? `${prevPath}/${folderName}` : folderName;
      fetchFiles(newPath);
      return newPath;
    });
  };

  const handleGoBack = () => {
    setCurrentPath((prevPath) => {
      const parts = prevPath.split("/");
      parts.pop();
      const newPath = parts.join("/");
      fetchFiles(newPath);
      return newPath;
    });
  };

  const handleDownload = async (fileName: string) => {
    try {
      const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
      const response = await fetch(`http://naspi.local:5000/api/files/${filePath}`);

      if (!response.ok) throw new Error('Error al descargar archivo');

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showNotification('Error al descargar archivo', 'error');
    }
    fetchFiles(currentPath);
  };

  const handleDelete = async (fileName: string) => {
    try {
      const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
      const response = await fetch(`http://naspi.local:5000/api/files/${filePath}`, {

        method: 'DELETE',
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (response.ok) {
        showNotification('Archivo eliminado', 'success');
        console.log("Archivo eliminado:", data.message);
      } else {
        showNotification('Error al eliminar', 'error');
        console.error("Error al eliminar:", data.error);
      }
    } catch (error) {
      showNotification('Error en DELETE', 'error');
      console.error("Error en DELETE:", error);
    }
    fetchFiles(currentPath);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append('files', file));

    formData.append("path", currentPath); 

    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        showNotification('Archivos subidos correctamente', 'success');
        fetchFiles(currentPath);
      } else {
        showNotification('Error al subir archivos', 'error');
      }
      setUploading(false);
    };

    xhr.onerror = () => {
      showNotification('Error en la subida', 'error');
      setUploading(false);
    };

    xhr.open('POST', `http://naspi.local:5000/api/upload`, true);
    xhr.send(formData);
};


  const createFolder = async () => {
    const folderName = prompt("Ingrese el nombre de la carpeta:");
    if (!folderName) return;

    const response = await fetch('http://naspi.local:5000/api/create_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_name: folderName }),
    });

    const data = await response.json();
    showNotification(data.message, response.ok ? 'success' : 'error');
    fetchFiles(currentPath);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="space-y-6">
      {notification && <Notification message={notification.message} type={notification.type} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <h1 className="text-2xl md:text-3xl font-semibold">File Manager</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setViewMode('grid')}>
            <Grid className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setViewMode('list')}>
            <List className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={createFolder}>
            <PlusCircle className="w-4 h-4" /> Crear Carpeta
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Input type="file" multiple onChange={handleFileChange} className="hidden" id="fileUpload" />
        <label htmlFor="fileUpload" className="cursor-pointer flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600">
          <Upload className="w-5 h-5 mr-2" /> Subir archivos
        </label>
      </div>

      {/* Barra de progreso */}
      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}

      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">Archivos y Carpetas</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Botón para volver atrás a otra carpeta */}
          <div className="flex items-center space-x-4 mb-4">
            {currentPath && (
              <Button variant="outline" onClick={handleGoBack}>
                ⬅️ Volver Atrás
              </Button>
            )}
            <span className="text-gray-600 dark:text-gray-300">{currentPath || "Raíz"}</span>
          </div>
          {/* Botones para manejar la descarga, eliminación de ficheros y detectar si son Ficheros o Carpetas */}
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'grid-cols-1 gap-2'}`}>
            {files.map((item, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg cursor-pointer ${viewMode === 'grid' ? 'text-center' : 'flex items-center'} 
                dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden`}
                onClick={() => item.isFolder ? handleEnterFolder(item.name) : null}
              >
                {item.isFolder ? (
                  <Folder className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto" />
                ) : (
                  <File className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>

                {!item.isFolder && (
                  <div className="flex space-x-2 mt-2">
                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(item.name); }}>
                      <Trash className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
