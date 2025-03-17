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

  const handleDownload = async (fileName: string) => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files/${fileName}`);
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
  };

  const handleDelete = async (fileName: string) => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files/${fileName}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (response.ok) {
        showNotification('Archivo eliminado correctamente', 'success');
        fetchFiles(currentPath);
      } else {
        showNotification(result.error || 'Error al eliminar archivo', 'error');
      }
    } catch (error) {
      showNotification('Error al eliminar archivo', 'error');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append('files', file));

    try {
      const response = await fetch(`http://naspi.local:5000/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        showNotification('Archivos subidos correctamente', 'success');
        fetchFiles(currentPath);
      } else {
        showNotification(result.error || 'Error al subir archivos', 'error');
      }
    } catch (error) {
      showNotification('Error al subir archivos', 'error');
    }
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

      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">Archivos y Carpetas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'grid-cols-1 gap-2'}`}>
            {files.map((item, index) => (
              <div key={index} className={`p-4 border rounded-lg cursor-pointer ${viewMode === 'grid' ? 'text-center' : 'flex items-center'} dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden`}>
                {item.isFolder ? (
                  <Folder className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto" />
                ) : (
                  <File className="w-12 h-12 text-gray-500 dark:text-gray-400 mx-auto" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                {!item.isFolder && (
                  <div className="flex space-x-2 mt-2">
                    <Button variant="ghost" onClick={() => handleDownload(item.name)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" onClick={() => handleDelete(item.name)}>
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
