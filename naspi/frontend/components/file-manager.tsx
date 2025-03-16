import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, Search, ArrowLeft } from 'lucide-react';

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
      setFiles(data.files.map((file: string) => ({ name: file, type: '', isFolder: false })));
      setCurrentPath(path);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const formData = new FormData();
    Array.from(fileList).forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`http://naspi.local:5000/api/files?path=${currentPath}`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        showNotification('Files uploaded successfully!', 'success');
        fetchFiles(currentPath);
      } else {
        showNotification(result.error || 'Error uploading files', 'error');
      }
    } catch (error) {
      showNotification('Error uploading files', 'error');
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files/download?path=${currentPath}/${fileName}`);
      if (!response.ok) throw new Error('Error downloading file');

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showNotification('Error downloading file', 'error');
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files?path=${currentPath}/${fileName}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (response.ok) {
        showNotification('File deleted successfully!', 'success');
        fetchFiles(currentPath);
      } else {
        showNotification(result.error || 'Error deleting file', 'error');
      }
    } catch (error) {
      showNotification('Error deleting file', 'error');
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
              >
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
