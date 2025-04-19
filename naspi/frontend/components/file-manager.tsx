import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, PlusCircle } from 'lucide-react';

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
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [notification, setNotification] = useState<NotificationProps | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null); // 📌 Nuevo estado

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    setUploading(true);
    setUploadProgress(0);

    await uploadFilesQueue(filesArray);

    setUploading(false);
    setUploadingFileName(null); // 📌 Limpiar nombre al finalizar
  };

  const uploadFilesQueue = async (files: File[]) => {
    let completed = 0;
    const totalFiles = files.length;

    for (const file of files) {
      setUploadingFileName(file.name); // 📌 Actualizar nombre del archivo actual
      const formData = new FormData();
      formData.append('files', file);
      formData.append("path", currentPath || "");

      try {
        await uploadSingleFile(formData);
        completed++;
        setUploadProgress(Math.round((completed / totalFiles) * 100));
      } catch (error) {
        console.error("Error al subir archivo:", error);
      }
    }

    fetchFiles(currentPath);
  };

  const uploadSingleFile = (formData: FormData) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(true);
        } else {
          reject(new Error(`Error en la subida: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Error en la conexión"));

      xhr.open('POST', `http://naspi.local:5000/api/upload`, true);
      xhr.send(formData);
    });
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="space-y-6">
      {notification && <Notification message={notification.message} type={notification.type} />}

      <div className="flex items-center space-x-4">
        <Input type="file" multiple onChange={handleFileChange} className="hidden" id="fileUpload" />
        <label htmlFor="fileUpload" className="cursor-pointer flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600">
          <Upload className="w-5 h-5 mr-2" /> Subir archivos
        </label>
      </div>

      {/* 📌 Mostrar barra de progreso y nombre del archivo */}
      {uploading && (
        <div className="w-full mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Subiendo: {uploadingFileName}</p>
          <div className="bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">Archivos y Carpetas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((item, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg cursor-pointer dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden"
              >
                {item.isFolder ? (
                  <Folder className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto" />
                ) : (
                  <File className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
