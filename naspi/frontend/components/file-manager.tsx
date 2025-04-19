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
  const [uploadProgress, setUploadProgress] = useState<number>(0); // Estado para la barra de progreso (del archivo actual)
  const [uploading, setUploading] = useState<boolean>(false); // Estado para indicar que se está subiendo
  // 📌 Reintroducir estado para el nombre del archivo subiendo
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);


  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchFiles = async (path: string = '') => {
    try {
      const response = await fetch(`http://naspi.local:5000/api/files?path=${path}`);
      // Check if response is OK (status 2xx)
      if (!response.ok) {
          const errorData = await response.json(); // Attempt to read error message
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || response.statusText}`);
      }
      const data: { folders: string[]; files: string[] } = await response.json();

      // Ordenar archivos: carpetas primero, luego archivos, alfabéticamente
      const sortedFiles = [
          ...data.folders.map((folder) => ({ name: folder, isFolder: true })),
          ...data.files.map((file) => ({ name: file, isFolder: false })),
      ].sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1; // Carpetas antes que archivos
          if (!a.isFolder && b.isFolder) return 1;  // Archivos después de carpetas
          return a.name.localeCompare(b.name); // Orden alfabético
      });


      setFiles(sortedFiles);
      setCurrentPath(path);
    } catch (error: any) { // Use 'any' or a more specific type like Error
      showNotification('Error cargando archivos', 'error');
      console.error('Error fetching files:', error.message || error); // Log actual error message
      setFiles([]); // Clear files on error
      // setCurrentPath(''); // Optionally reset path on fetch error? Maybe not ideal.
    }
  };

  const handleEnterFolder = (folderName: string) => {
    // Simple validation for folder names (optional)
    if (folderName.includes('/') || folderName.includes('\\')) {
        console.error("Invalid folder name characters");
        showNotification("Nombre de carpeta no válido", "error");
        return;
    }
     // Avoid navigating into "." or ".." if they were somehow listed
     if (folderName === '.' || folderName === '..') {
         console.warn("Attempted to navigate into '.' or '..'");
         return;
     }

    setCurrentPath((prevPath) => {
      // Construir la nueva ruta correctamente
      const newPath = prevPath ? `${prevPath}/${folderName}` : folderName;
      fetchFiles(newPath); // Fetch new content
      return newPath; // Update state
    });
  };

  const handleGoBack = () => {
    setCurrentPath((prevPath) => {
      // Volver a la raíz si ya estamos en una subcarpeta
      if (!prevPath) {
           console.warn("Attempted to go back from root");
           return ""; // Already at root, no change
      }

      const parts = prevPath.split("/");
      parts.pop(); // Remove the last part (current folder)
      const newPath = parts.join("/");

      fetchFiles(newPath); // Fetch parent folder content
      return newPath; // Update state
    });
  };


  const handleDeleteFolder = async () => {
    if (!currentPath) {
      showNotification("No puedes eliminar la carpeta raíz", "error");
      return;
    }

    // Extract just the name of the current folder for the confirmation message
    const currentFolderName = currentPath.split('/').pop() || 'esta carpeta'; // Fallback name
    const confirmDelete = window.confirm(`¿Seguro que deseas eliminar la carpeta "${currentFolderName}" y todo su contenido?`);
    if (!confirmDelete) return;

    try {
      // Encode the full path to handle special characters
      const encodedPath = encodeURIComponent(currentPath);
      const response = await fetch(`http://naspi.local:5000/api/folders/${encodedPath}`, {
        method: 'DELETE',
        // Headers might not be strictly needed for DELETE with path in URL
        // headers: { "Content-Type": "application/json" }
      });

      // Assume backend sends JSON response even on error
      const data = await response.json();

      if (response.ok) {
        showNotification(`Carpeta "${currentFolderName}" eliminada correctamente`, "success");
         // Calculate parent path to go back to
        const parentPath = currentPath.split('/').slice(0, -1).join('/');
        // No need to update currentPath state directly, fetchFiles will do it
        fetchFiles(parentPath); // Fetch and navigate back to parent folder
      } else {
         // Backend error message
        showNotification(`Error al eliminar "${currentFolderName}": ${data.error || response.statusText}`, "error");
        console.error("Error al eliminar carpeta:", data.error || response.statusText);
         // Re-fetch files even on error to show current state (maybe deletion partially failed?)
        fetchFiles(currentPath);
      }
    } catch (error: any) { // Use 'any' or a more specific error type if known
      showNotification(`Error de red al eliminar la carpeta "${currentFolderName}"`, "error");
      console.error("Error en DELETE folder:", error.message || error);
       // Re-fetch files even on error
       fetchFiles(currentPath);
    }
  };

   const handleDownload = async (fileName: string) => {
     if (!fileName) return; // Should not happen, but safety check
    try {
      const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
       // Encode the full file path for the URL
      const encodedFilePath = encodeURIComponent(filePath);
      const response = await fetch(`http://naspi.local:5000/api/files/${encodedFilePath}`);

      if (!response.ok) {
         const errorData = await response.json(); // Assuming backend sends { error: "message" }
         throw new Error(`Error al descargar archivo: ${errorData.error || response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName; // Use original filename for download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up the object URL

      showNotification(`"${fileName}" descargado correctamente`, "success");

    } catch (error: any) { // Use 'any' or a more specific error type if known
      showNotification(`Error al descargar "${fileName}"`, 'error');
      console.error("Error al descargar archivo:", error.message || error);
    }
    // No need to re-fetch files after download, the list hasn't changed
  };

   const handleDelete = async (fileName: string) => {
     if (!fileName) return; // Safety check
     const confirmDelete = window.confirm(`¿Seguro que deseas eliminar el archivo "${fileName}"?`);
     if (!confirmDelete) return;

    try {
      const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
      // Encode the full file path for the URL
      const encodedFilePath = encodeURIComponent(filePath);

      const response = await fetch(`http://naspi.local:5000/api/files/${encodedFilePath}`, {
        method: 'DELETE',
        // Headers might not be strictly needed for DELETE with path in URL
        // headers: { "Content-Type": "application/json" }
      });

       // Assume backend sends JSON response even on error
      const data = await response.json();

      if (response.ok) {
        showNotification(`Archivo "${fileName}" eliminado`, 'success');
        // console.log("Archivo eliminado:", data.message);
        fetchFiles(currentPath); // Refresh list after successful deletion
      } else {
        showNotification(`Error al eliminar "${fileName}": ${data.error || response.statusText}`, 'error');
        console.error("Error al eliminar archivo:", data.error || response.statusText);
         // Re-fetch files even on error to show current state
        fetchFiles(currentPath);
      }
    } catch (error: any) { // Use 'any' or a more specific error type if known
      showNotification(`Error de red al eliminar el archivo "${fileName}"`, 'error');
      console.error("Error en DELETE file:", error.message || error);
      // Re-fetch files even on error
      fetchFiles(currentPath);
    }
  };


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
         event.target.value = ''; // Clear the input value so the same file can be selected again
         return;
    }


    const filesArray = Array.from(fileList);
    setUploading(true);
    setUploadProgress(0); // Reset progress for the new batch
    setUploadingFileName(null); // Reset name before starting the queue

    await uploadFilesQueue(filesArray);

    setUploading(false);
    setUploadingFileName(null); // Clean up name after finishing all uploads
    setUploadProgress(0); // Reset progress bar at the end of the queue

    fetchFiles(currentPath);  // Recargar archivos después de que toda la cola termine
    event.target.value = ''; // Clear the input value after finishing
  };

  const uploadFilesQueue = async (files: File[]) => {
    // let completed = 0; // No longer needed for the progress bar/text display
    // const totalFiles = files.length; // Useful for context if you add it to text later (e.g., File X of Y)

    for (const file of files) {
      setUploadingFileName(file.name); // 📌 Update name of the current file before starting its upload
      setUploadProgress(0); // 📌 Reset progress bar for the new file

      const formData = new FormData();
      formData.append('file', file); // ❗ Changed key from 'files' to 'file' - usually backend expects one file per request like this
                                     // If your backend *specifically* handles 'files' for one file, change back.
      const safePath = currentPath ? currentPath.trim() : "";
      formData.append("path", safePath);

      try {
        await uploadSingleFile(formData, file.name); // Pass file name for potential error messages in promise
        // completed++; // No longer needed for the primary progress state
        // ❌ REMOVED: setUploadProgress(Math.round((completed / totalFiles) * 100)); // <-- Removed this line
      } catch (error: any) { // Use 'any' or specific error type
        console.error(`Error al subir archivo ${file.name}:`, error.message); // Log specific file error
        showNotification(`Error al subir "${file.name}"`, 'error'); // Notify user about specific file failure
        // Decide: continue the queue (current behavior) or stop? Current behavior is fine.
      }
    }
    // fetchFiles(currentPath); // Moved fetch outside the loop to happen once at the end (in handleFileChange)
  };

  // Added fileName parameter for better error messages
  const uploadSingleFile = (formData: FormData, fileName: string) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete); // <-- This updates the state used in the UI text and bar
        }
      };

      xhr.onload = () => {
        // Check for successful status codes (2xx)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          // Provide more detail in the error
          // Attempt to parse backend error, fallback to status text
           let errorMessage = `Error desconocido (Estado: ${xhr.status})`;
           try {
               const responseJson = JSON.parse(xhr.responseText);
               errorMessage = responseJson.error || responseJson.message || xhr.statusText || errorMessage;
           } catch (e) {
                errorMessage = xhr.statusText || errorMessage;
           }
          reject(new Error(`Error en la subida de "${fileName}": ${errorMessage}`));
        }
      };

      xhr.onerror = () => reject(new Error(`Error de red al subir "${fileName}"`));
      xhr.ontimeout = () => reject(new Error(`Tiempo de espera agotado al subir "${fileName}"`));

      xhr.open('POST', `http://naspi.local:5000/api/upload`, true);
      // Optional: Add headers if needed, e.g., authorization
      // xhr.setRequestHeader('Authorization', 'Bearer your_token');
      xhr.send(formData);
    });
  };


  const createFolder = async () => {
    const folderName = prompt("Ingrese el nombre de la carpeta:");
    if (!folderName || folderName.trim() === "") {
        if (folderName !== null) showNotification("El nombre de la carpeta no puede estar vacío", "error");
        return;
    }

    // Simple validation: avoid slashes or other problematic characters in name
    const invalidChars = /[\\/:*?"<>|]/; // Common invalid characters
    if (invalidChars.test(folderName)) {
         showNotification(`El nombre de la carpeta no puede contener los siguientes caracteres: \\ / : * ? " < > |`, "error");
         return;
    }


    try {
        const response = await fetch('http://naspi.local:5000/api/create_folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder_name: folderName.trim(), // Use trimmed name
            current_path: currentPath
          }),
        });

        const data = await response.json();
        showNotification(data.message, response.ok ? 'success' : 'error');

        if (response.ok) {
             fetchFiles(currentPath); // Refresh list on success
        } else {
            console.error("Error creating folder:", data.error || response.statusText);
            // Optionally re-fetch even on error to show current state
            // fetchFiles(currentPath);
        }

    } catch (error: any) { // Use 'any' or specific error type
        showNotification("Error de red al crear la carpeta", 'error');
        console.error("Error creating folder (fetch):", error.message || error);
    }
  };


  useEffect(() => {
    fetchFiles();
  }, []);

  // Render function
  return (
    <div className="space-y-6 p-4 bg-gray-100 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100"> {/* Added padding and background */}
      {/* Notifications */}
      {notification && <Notification message={notification.message} type={notification.type} />}

      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <h1 className="text-2xl md:text-3xl font-semibold">File Manager</h1>
        <div className="flex items-center space-x-2 flex-wrap gap-2"> {/* Use flex-wrap and gap for small screens */}
          {/* View Mode Toggle */}
          <Button variant={viewMode === 'grid' ? 'secondary' : 'outline'} onClick={() => setViewMode('grid')} title="Vista de cuadrícula">
            <Grid className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'outline'} onClick={() => setViewMode('list')} title="Vista de lista">
            <List className="w-4 h-4" />
          </Button>
          {/* Create Folder Button */}
          <Button variant="outline" onClick={createFolder}>
            <PlusCircle className="w-4 h-4 mr-1" /> Crear Carpeta
          </Button>
          {/* Delete Current Folder Button */}
           {/* Show only if not at root */}
          {currentPath && (
            <Button variant="outline" onClick={handleDeleteFolder}>
              <Trash className="w-4 h-4 mr-1 text-red-500" /> Eliminar Carpeta
            </Button>
          )}
        </div>
      </div>

      {/* Upload Button */}
      <div className="flex items-center space-x-4">
        <Input type="file" multiple onChange={handleFileChange} className="hidden" id="fileUpload" />
        <label htmlFor="fileUpload" className="cursor-pointer flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600">
          <Upload className="w-5 h-5 mr-2" /> Subir archivos
        </label>
        {/* Add other main actions like "Upload Folder" here if supported */}
      </div>

      {/* 📌 Barra de progreso y texto con nombre y porcentaje */}
      {uploading && (
        <div className="w-full mt-2">
           {/* 📌 Texto mostrando nombre y porcentaje del archivo actual */}
           {uploadingFileName && (
             <p className="text-sm text-gray-700 dark:text-gray-300 mb-1"> {/* Adjusted text color */}
               Subiendo: <span className="font-semibold">{uploadingFileName}</span>: {uploadProgress}%
             </p>
           )}
           {/* Progress Bar */}
          <div className="w-full bg-gray-300 rounded-full h-2.5 dark:bg-gray-700"> {/* Adjusted background color */}
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-100 ease-linear" // Added transition
              style={{ width: `${uploadProgress}%` }} // <-- Bar width still uses the same state
            ></div>
          </div>
        </div>
      )}

      {/* File and Folder Listing Card */}
      <Card className="bg-white dark:bg-gray-800 shadow-lg"> {/* Added shadow */}
        <CardHeader>
          <CardTitle className="text-lg font-medium">Archivos y Carpetas</CardTitle> {/* Removed redundant text-color */}
        </CardHeader>
        <CardContent>
          {/* Breadcrumbs/Back Button and Current Path */}
          <div className="flex items-center space-x-2 mb-4 flex-wrap gap-y-2">
             {/* Back Button */}
            {currentPath && (
               <Button variant="outline" size="sm" onClick={handleGoBack} title="Volver a la carpeta anterior">
                 ⬅️ Volver
               </Button>
             )}
             {/* Current Path Display (can be expanded to breadcrumbs) */}
            <span className="text-gray-600 dark:text-gray-300 text-sm truncate" title={currentPath || "Raíz"}>
                {/* Corrected Breadcrumb rendering */}
                {currentPath
                    ? currentPath.split('/').map((part, index, arr) => (
                       <React.Fragment key={index}>
                           <span>{part}</span>
                           {index < arr.length - 1 && <span className="mx-1">/</span>}
                       </React.Fragment>
                    ))
                    : "Raíz"
                }
            </span>
          </div>
          {/* File and Folder Grid/List */}
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4' : 'grid-cols-1 gap-2'}`}> {/* Adjusted grid cols for density */}
            {files.map((item, index) => (
              <div
                key={index}
                 // Handle folder click, prevent file click from navigating
                className={`p-4 border rounded-lg cursor-pointer transition-shadow hover:shadow-md
                           ${viewMode === 'grid' ? 'text-center' : 'flex items-center space-x-4'}
                           dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden`}
                onClick={() => item.isFolder ? handleEnterFolder(item.name) : null} // Only navigate on folder click
                // Add context menu or right-click handler here if needed
              >
                {/* Icon */}
                {item.isFolder ? (
                  <Folder className={`text-gray-500 dark:text-gray-400 ${viewMode === 'grid' ? 'w-12 h-12 mx-auto mb-2' : 'w-8 h-8 flex-shrink-0'}`} />
                ) : (
                  <File className={`text-gray-500 dark:text-gray-400 ${viewMode === 'grid' ? 'w-12 h-12 mx-auto mb-2' : 'w-8 h-8 flex-shrink-0'}`} />
                )}
                 {/* Name and Actions Wrapper */}
                 <div className={`${viewMode === 'grid' ? 'block' : 'flex justify-between items-center flex-grow min-w-0'}`}> {/* Adjusted layout for list view */}
                     {/* Name */}
                     <span className={`text-sm text-gray-700 dark:text-gray-300 truncate ${viewMode === 'list' ? 'flex-grow min-w-0 mr-4' : 'block'}`} title={item.name}>
                         {item.name}
                     </span>

                     {/* File Actions (Download, Delete) */}
                     {!item.isFolder && (
                       <div className={`flex space-x-1 ${viewMode === 'grid' ? 'mt-2 justify-center' : 'flex-shrink-0'}`}> {/* Adjusted button size and justification */}
                         <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(item.name); }} title={`Descargar ${item.name}`}>
                           <Download className="w-4 h-4" />
                         </Button>
                         <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(item.name); }} title={`Eliminar ${item.name}`}>
                           <Trash className="w-4 h-4 text-red-500" />
                         </Button>
                       </div>
                     )}
                 </div> {/* End Name and Actions Wrapper */}

              </div>
            ))}
          </div>
           {/* Message if no files/folders */}
          {files.length === 0 && !uploading && (
             <p className="text-center text-gray-500 dark:text-gray-400">No hay archivos ni carpetas en esta ubicación.</p>
          )}
           {/* Message while loading? */}
           {/* You might want a loading state while fetchFiles is running */}
        </CardContent>
      </Card>
    </div>
  );
}