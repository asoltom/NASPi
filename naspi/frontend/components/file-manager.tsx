import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, Search, ArrowLeft } from 'lucide-react';

// Componente para mostrar notificaciones emergentes
const Notification = ({ message, type }: { message: string; type: "success" | "error" }) => {
  return (
    <div className={`fixed top-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white text-sm 
      ${type === "success" ? "bg-green-500" : "bg-red-500"}`}>
      {message}
    </div>
  );
};

export default function FileManager() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [files, setFiles] = useState<{ name: string; type: string; isFolder: boolean }[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchFiles = async (path = '') => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files?path=${path}`);
      const data = await response.json();
      
      setFiles(data);
      setCurrentPath(path);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const filesArray = Array.from(fileList);
    const formData = new FormData();
    filesArray.forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`http://naspi.local:5000/api/files?path=${currentPath}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        showNotification('Files uploaded successfully!', 'success');
        fetchFiles(currentPath);
      } else {
        showNotification('Error uploading files', 'error');
      }
    } catch (error) {
      showNotification('Error uploading files', 'error');
    }
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
        </div>
      </div>

      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex w-full md:w-64">
          <Input placeholder="Search files..." className="w-full rounded-r-none" />
          <Button className="rounded-l-none" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
          <input type="file" id="file-input" className="hidden" multiple {...({ webkitdirectory: true } as any)} onChange={handleFileChange} />
          <Button onClick={() => document.getElementById('file-input')?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Folder
          </Button>
        </div>
      </div>

      {currentPath && (
        <Button variant="outline" onClick={() => fetchFiles(currentPath.split('/').slice(0, -1).join('/'))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      )}

      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">Files and Folders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'grid-cols-1 gap-2'}`}>
            {files.map((item, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg cursor-pointer ${viewMode === 'grid' ? 'text-center' : 'flex items-center'}
                          dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden`}
                onClick={() => item.isFolder ? fetchFiles(`${currentPath}/${item.name}`) : setSelectedFile(`${item.name}.${item.type}`)}
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
