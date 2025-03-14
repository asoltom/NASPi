import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, Search } from 'lucide-react';

// Componente para mostrar notificaciones emergentes
const Notification = ({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) => {
  return (
    <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white text-sm 
      ${type === "success" ? "bg-green-500" : "bg-red-500"}`}>
      {message}
    </div>
  );
};

export default function FileManager() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [files, setFiles] = useState<{ name: string; type: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000); // Desaparece en 3 segundos
  };

  const fetchFiles = async () => {
    try {
      const response = await fetch('http://naspi.local:5000/api/files');
      const data = await response.json();

      const files = data.map((item: string) => ({
        name: item.split('.').slice(0, -1).join('.') || item,
        type: item.includes('.') ? item.split('.').pop() : ""
      }));

      setFiles(files);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://naspi.local:5000/api/files', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        showNotification('File uploaded successfully!', 'success');
        fetchFiles();
      } else {
        console.error('Error uploading file:', await response.text());
        showNotification('Error uploading file', 'error');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showNotification('Error uploading file', 'error');
    }
  };

  const handleDownload = async () => {
    if (!selectedFile) {
      showNotification('Select a file first!', 'error');
      return;
    }

    try {
      const response = await fetch(`http://naspi.local:5000/api/files/${selectedFile}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = selectedFile;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
      showNotification('Error downloading file', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) {
      showNotification('Select a file first!', 'error');
      return;
    }

    try {
      const response = await fetch(`http://naspi.local:5000/api/files/${selectedFile}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        showNotification('File deleted successfully!', 'success');
        fetchFiles();
      } else {
        const errorText = await response.text();
        console.error('Error deleting file:', errorText);
        showNotification('Error deleting file', 'error');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showNotification('Error deleting file', 'error');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="space-y-6">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

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
          <input type="file" id="file-input" className="hidden" onChange={handleFileChange} />
          <Button onClick={() => document.getElementById('file-input')?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>

          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>

          <Button variant="outline" onClick={handleDelete}>
            <Trash className="w-4 h-4 mr-2" />
            Delete
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
                className={`p-4 border rounded-lg ${viewMode === 'grid' ? 'text-center' : 'flex items-center'} 
                          dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden cursor-pointer
                          ${selectedFile === `${item.name}${item.type ? '.' + item.type : ''}` ? 'border-blue-500 bg-blue-100 dark:bg-blue-900' : ''}`}
                onClick={() => setSelectedFile(`${item.name}${item.type ? '.' + item.type : ''}`)}
              >
                <File className={`w-12 h-12 flex-shrink-0 ${viewMode === 'grid' ? 'mx-auto mb-2' : 'mr-4'} text-gray-500 dark:text-gray-400`} />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}.{item.type || "No type"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
