import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, File, Grid, List, Upload, Download, Trash, Search } from 'lucide-react';

export default function FileManager() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [files, setFiles] = useState<{ name: string; type: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Obtener la lista de archivos desde el backend
  const fetchFiles = async () => {
    try {
      const response = await fetch('http://naspi.local:5000/api/files');
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  // Descargar un archivo
  const downloadFile = async (filename: string) => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files/${filename}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  // Subir un archivo
  const uploadFile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://naspi.local:5000/api/files', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('File uploaded successfully!');
        fetchFiles(); // Actualizar lista de archivos
      } else {
        console.error('Error uploading file:', await response.text());
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="space-y-6">
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
          <form onSubmit={uploadFile} className="flex items-center space-x-2">
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </label>
            <Button type="submit">Submit</Button>
          </form>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button variant="outline">
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
                className={`p-4 border rounded-lg ${viewMode === 'grid' ? 'text-center' : 'flex items-center'} dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden`}
              >
                {item.type === 'folder' ? (
                  <Folder className={`w-12 h-12 flex-shrink-0 ${viewMode === 'grid' ? 'mx-auto mb-2' : 'mr-4'} text-blue-500 dark:text-blue-400`} />
                ) : (
                  <File className={`w-12 h-12 flex-shrink-0 ${viewMode === 'grid' ? 'mx-auto mb-2' : 'mr-4'} text-gray-500 dark:text-gray-400`} />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                {item.type !== 'folder' && (
                  <Button variant="link" onClick={() => downloadFile(item.name)}>
                    Download
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
