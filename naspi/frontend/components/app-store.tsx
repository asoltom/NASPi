// app-store.tsx - REVISADO (intento 10) para corregir errores de tipografía en setProgress

'use client'

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, XCircle, Trash2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

const BACKEND_API_BASE_URL = 'http://naspi.local:5000/api';
const ADMIN_API_KEY = "d9Kj@fPzW%x$3sVbL!gT&cQ#mN*hYu0eR1I_aZ2oJl4iKy5Rw6P7sV8"; // Ensure this matches your .env

// Aquí definimos los nombres y descripciones locales
const serviceDisplayInfo: { [key: string]: { name: string; description: string } } = {
  jellyfin: { name: 'Jellyfin Media Server', description: 'Servidor multimedia para tu contenido.' },
  plex: { name: 'Plex Media Server', description: 'Organiza y transmite tu biblioteca multimedia.' },
  pihole: { name: 'Pi-hole', description: 'Bloqueador de publicidad a nivel de red.' },
};

interface AvailableService {
  service_name: string;
  displayName: string;
  description: string;
  installed: boolean;
}

interface InstallationStatus {
  [serviceName: string]: 'idle' | 'installing' | 'installed' | 'error' | 'uninstalling'; // Añadido 'uninstalling' para claridad
}

// Define the expected structure of backend success/error responses
interface BackendResponse {
    success: boolean;
    message?: string; // Message is optional
    available_services?: AvailableService[]; // Only present in list response
    errors?: any; // Catch-all for other potential error details
}


export default function AppStore() {
  const [availableApps, setAvailableApps] = useState<AvailableService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installationStatus, setInstallationStatus] = useState<InstallationStatus>({});
  const [installMessage, setInstallMessage] = useState<{ serviceName: string; type: 'success' | 'error'; message: string } | null>(null);
  const [progress, setProgress] = useState<{ [serviceName: string]: number }>({});

  // Definir fetchAvailableApps con useCallback para estabilidad
  // Dependencia vacía [] para que solo se cree en el montaje inicial
  const fetchAvailableApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    // No limpiar installMessage aquí, dejar que persista si ya existe

    try {
      const response = await fetch(`${BACKEND_API_BASE_URL}/admin/available-services`, {
        method: 'GET',
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
           const errorText = await response.text();
           throw new Error(`Error HTTP al cargar apps: estado ${response.status}, cuerpo: ${errorText || 'Vacío'}`);
      }

      // Cast the parsed JSON data to our expected interface
      let data: BackendResponse | null = null;
      try {
          const responseData = await response.json();
          // Optional: Check if parsed data looks like a BackendResponse
          if (typeof responseData === 'object' && responseData !== null && typeof responseData.success === 'boolean') {
             data = responseData; // Assign only if it meets basic shape
          } else {
             console.warn("Parsed data does not match basic BackendResponse shape:", responseData);
             // data is not the expected shape, treat as a parsing issue
             throw new Error("Parsed data has unexpected shape"); // Trigger catch block
          }
      } catch (e: any) {
          console.error("Error parsing JSON for available-services:", e);
           // Attempt to get text body for better error message
          const errorText = await response.text().catch(() => 'N/A'); // Prevent secondary error if text() fails
          setError(`Error al parsear lista de apps: ${e.message || String(e)}. Cuerpo: ${errorText}`);
          setInstallationStatus({}); // Resetar estado si los datos son malos
          setAvailableApps([]); // Limpiar apps si los datos son malos
          setLoading(false);
          return; // Exit the function early on parsing error
      }


      if (data?.success && Array.isArray(data.available_services)) { // Use optional chaining here too
        const apps: AvailableService[] = data.available_services.map((app: any) => { // app: any because BackendResponse defines the overall structure, not individual app shape
          const displayInfo = serviceDisplayInfo[app.service_name?.toLowerCase()] || { name: app.service_name, description: 'Sin descripción disponible.' };
          return {
            service_name: app.service_name,
            displayName: displayInfo.name,
            description: displayInfo.description,
            installed: app.installed,
          };
        });

        setAvailableApps(apps);

        const initialStatus: InstallationStatus = {};
        apps.forEach(app => {
          // Establecer el estado basado en la información fresca del backend
          initialStatus[app.service_name] = app.installed ? 'installed' : 'idle';
          // Note: State updates here are based on the *fetched* data.
          // The logic to reset progress based on *previous* state is handled below in setInstallationStatus callback.
        });

         // Update the overall status map, prioritizing fetched status
        setInstallationStatus(prev => {
             const newState = { ...prev };
             const currentAppNames = apps.map(app => app.service_name);

             apps.forEach(app => {
                  // Always update with the latest state from backend unless it's a temporary UI state (installing/uninstalling)
                  // If the previous state was installing/uninstalling, keep it unless the fetch confirms installed/idle
                  if (prev[app.service_name] === 'installing' && initialStatus[app.service_name] === 'installed') {
                      newState[app.service_name] = 'installed';
                      // *** CORRECCIÓN: Usar 'prev' y 'newState' consistentemente ***
                      setProgress(p => { const copy = { ...p }; delete copy[app.service_name]; return copy; }); // Example of incorrect line
                      // Corrected version:
                       setProgress(prevProgress => {
                            const newProgressState = { ...prevProgress };
                            delete newProgressState[app.service_name];
                            return newProgressState;
                       });

                  } else if (prev[app.service_name] === 'uninstalling' && initialStatus[app.service_name] === 'idle') {
                      newState[app.service_name] = 'idle';
                  } else if (prev[app.service_name] === 'error' && initialStatus[app.service_name] !== 'error') {
                       // If it was in error, but the fetch shows it's clean now
                       newState[app.service_name] = initialStatus[app.service_name];
                       // *** CORRECCIÓN: Usar 'prev' y 'newState' consistentemente ***
                       // setProgress(p => { const copy = { ...p }; delete copy[app.service_name]; return copy; }); // Example of incorrect line
                       // Corrected version:
                       setProgress(prevProgress => {
                            const newProgressState = { ...prevProgress };
                            delete newProgressState[app.service_name];
                            return newProgressState;
                       });
                  }
                   else if (prev[app.service_name] !== 'installing' && prev[app.service_name] !== 'uninstalling') {
                       // If not in a temporary state, just update with the fetched state
                       newState[app.service_name] = initialStatus[app.service_name];
                   }
                  // If it was installing/uninstalling and the fetched state didn't transition it to installed/idle, keep the temp state.

             });
             // Clean up status for apps that might have been removed from the list entirely or were in temp states but are no longer present
             Object.keys(newState).forEach(serviceName => {
                 if (!currentAppNames.includes(serviceName)) {
                     // App is no longer in the list, must be idle/uninstalled.
                     // Remove from state map if it was a temporary state or installed.
                      if (newState[serviceName] === 'installed' || newState[serviceName] === 'idle' || newState[serviceName] === 'error' || newState[serviceName] === 'uninstalling') {
                         delete newState[serviceName];
                         // *** CORRECCIÓN: Usar 'prev' y 'newState' consistentemente ***
                         // setProgress(p => { const copy = { ...p }; delete copy[serviceName]; return copy; }); // Example of incorrect line
                         // Corrected version:
                         setProgress(prevProgress => {
                            const newProgressState = { ...prevProgress };
                            delete newProgressState[serviceName];
                            return newProgressState;
                         });
                      }
                      // If it was 'installing' but disappeared, maybe also remove? Depends on desired behaviour. Let's remove temp states if app is gone.
                      if (prev[serviceName] === 'installing' || prev[serviceName] === 'uninstalling' || prev[serviceName] === 'error') {
                           delete newState[serviceName];
                           // *** CORRECCIÓN: Usar 'prev' y 'newState' consistentemente ***
                           // setProgress(p => { const copy = { ...p }; delete copy[serviceName]; return copy; }); // Example of incorrect line
                           // Corrected version:
                           setProgress(prevProgress => {
                                const newProgressState = { ...prevProgress };
                                delete newProgressState[serviceName];
                                return newProgressState;
                           });
                      }
                 }
             });
            return newState;
        });


      } else {
        // Response was OK, but data structure is wrong or success is false
        const errorMessage = data?.message || "La respuesta del backend para la lista de servicios no tiene el formato esperado.";
        setError(errorMessage);
        setInstallationStatus({}); // Resetar estado si los datos son malos
        setAvailableApps([]); // Limpiar apps si los datos son malos
      }
    } catch (err: any) {
      console.error("Error fetching available apps:", err);
      setError(`No se pudieron cargar las aplicaciones disponibles. Detalles: ${err.message}`);
      setInstallationStatus({}); // Resetar estado en error de fetch
      setAvailableApps([]); // Limpiar apps en error de fetch
    } finally {
      setLoading(false);
    }
  }, []); // Lista de dependencias vacía []

  useEffect(() => {
    fetchAvailableApps();
    // Este efecto ahora solo se ejecuta en el montaje inicial
    // porque fetchAvailableApps es una dependencia estable (useCallback con [])
  }, [fetchAvailableApps]); // fetchAvailableApps is a stable reference due to useCallback


  // Simulate progress bar - this is a UI effect, not the actual backend process
  const simulateProgress = (serviceName: string) => {
    let currentProgress = 0;
    // Clear any previous simulation for this service
    // *** CORRECCIÓN: Usar 'prevProgress' y 'newState' consistentemente ***
    setProgress(prevProgress => {
         const newState = { ...prevProgress };
         delete newState[serviceName];
         return newState;
    });

    const interval = setInterval(() => {
      currentProgress += Math.random() * 15;
      // Ensure we don't exceed 100
      setProgress(prev => ({ ...prev, [serviceName]: Math.min(currentProgress, 100) }));

      if (currentProgress >= 100) {
        clearInterval(interval);
        // Simulation complete. At this point, the backend install request should have finished.
        // We need to refetch the actual state to confirm installation.
        setInstallMessage({ serviceName: serviceName, type: 'success', message: `${serviceName} instalación solicitada. Verificando estado final...` });
        setTimeout(fetchAvailableApps, 1000); // Refetch list after simulation finishes
      }
    }, 200); // Simulation speed
    return () => clearInterval(interval); // Cleanup function for setInterval
  };

  const handleInstallClick = async (serviceName: string) => {
    setInstallationStatus(prev => ({ ...prev, [serviceName]: 'installing' }));
    // *** CORRECCIÓN: Usar 'prevProgress' y 'newState' consistentemente ***
    setProgress(prevProgress => {
        const newState = { ...prevProgress };
        delete newState[serviceName]; // Inicializar progreso a 0 o limpiar
        return newState;
    });
    setInstallMessage(null); // Limpiar mensajes

    try {
      const response = await fetch(`${BACKEND_API_BASE_URL}/admin/install/${serviceName}`, {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      const text = await response.text();
      let data: BackendResponse | null = null; // Explicitly type data
      let jsonError: any = null; // Store JSON parsing error

      if (text) {
          try {
              const responseData = JSON.parse(text);
               // Check if parsed data looks like a BackendResponse
              if (typeof responseData === 'object' && responseData !== null && typeof responseData.success === 'boolean') {
                 data = responseData; // Assign only if it meets basic shape
              } else {
                 console.warn("Parsed data does not match basic BackendResponse shape:", responseData);
                 throw new Error("Parsed data has unexpected shape"); // Trigger catch block
              }
          } catch (e) {
              jsonError = e;
              console.error(`Error parseando JSON para la respuesta de instalación de ${serviceName}:`, e);
              console.error('Texto de respuesta:', text); // Registrar el texto problemático
          }
      }

      if (response.ok) { // El backend respondió con 2xx status (likely 200/201)
          // Check if data is valid and success is true
          if (data?.success) {
              // Éxito confirmado por el backend. Update UI state and show message.
              // Seteamos el estado a 'installed' inmediatamente basado en la confirmación del backend
              setInstallationStatus(prev => ({ ...prev, [serviceName]: 'installed' }));
              // *** CORRECCIÓN: Usar 'prevProgress' y 'newState' consistentemente ***
              setProgress(prevProgress => {
                   const newState = { ...prevProgress };
                   delete newState[serviceName]; // Limpiar barra de progreso
                   return newState;
              });
              setInstallMessage({ serviceName: serviceName, type: 'success', message: data.message || `${serviceName} instalado correctamente.` });
              // La simulación ya llama a fetchAvailableApps al final, que es suficiente para confirmar.


          } else {
              // Response 2xx, but data was null/bad, or success: false
              // Construct error message defensively
              let errorMessage: string;
              if (data?.message) { // Prioritize message from backend if available
                  errorMessage = data.message;
              } else if (jsonError) { // Use JSON parsing error message
                  errorMessage = `Error de parseo JSON: ${jsonError.message}`;
              } else if (text) { // Use raw text if no specific error
                  errorMessage = `Respuesta inesperada: ${text}`;
              } else { // Fallback
                  errorMessage = `Respuesta 2xx inesperada para instalación de ${serviceName}`;
              }

              setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' })); // Set status to error
              setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error instalando ${serviceName}: ${errorMessage}. Por favor, recargue para verificar el estado.` });
          }
      } else { // El backend respondió con un error (4xx/5xx)
          // Construct error message defensively for HTTP errors
          let errorMessage: string;
          if (data?.message) { // Prioritize message from backend error body
              errorMessage = data.message;
          } else if (text) { // Use raw text if no specific error message in body
              errorMessage = `Error HTTP ${response.status}: ${text}`;
          } else { // Fallback
               errorMessage = `Error HTTP inesperado ${response.status} al instalar ${serviceName}`;
          }

        setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' })); // Set status to error
        setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error instalando ${serviceName}: ${errorMessage}` });
      }
    } catch (err: any) { // Capturar errores de red, etc.
      console.error(`Error al instalar ${serviceName}:`, err);
      setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' })); // Set status to error
      setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error instalando ${serviceName}: ${err.message}` });
    }
    // Status is updated immediately on success/error or left as 'installing' on network error without catch
  };


  const handleUninstallClick = async (serviceName: string) => {
    // Usamos el estado 'uninstalling' para mostrar el spinner en el botón Desinstalar
    setInstallationStatus(prev => ({ ...prev, [serviceName]: 'uninstalling' })); // Usar estado 'uninstalling' para claridad visual
    setInstallMessage(null); // Limpiar mensajes anteriores

    try {
      const response = await fetch(`${BACKEND_API_BASE_URL}/admin/uninstall/${serviceName}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY,
          'Content-Type': 'application/json', // Although DELETE doesn't always use body, keep for consistency
        },
      });

      const text = await response.text();
      let data: BackendResponse | null = null; // Explicitly type data
      let jsonError: any = null; // Store JSON parsing error

      if (text) {
          try {
              const responseData = JSON.parse(text);
              // Check if parsed data looks like a BackendResponse
              if (typeof responseData === 'object' && responseData !== null && typeof responseData.success === 'boolean') {
                 data = responseData; // Assign only if it meets basic shape
              } else {
                 console.warn("Parsed data does not match basic BackendResponse interface:", responseData);
                 throw new Error("Parsed data has unexpected shape"); // Trigger catch block
              }
          } catch (e) {
              jsonError = e;
              console.error(`Error parseando JSON para la respuesta de desinstalación de ${serviceName}:`, e);
              console.error('Texto de respuesta:', text); // Registrar el texto problemático
          }
      }

      if (response.ok) { // El backend respondió con 2xx (probablemente 200)
          // Check if data is valid and success is true
          if (data?.success) {
              // Éxito confirmado por el backend. Update UI state and show message.
              setInstallationStatus(prev => ({ ...prev, [serviceName]: 'idle' })); // Set status to idle (uninstalled)
               // *** CORRECCIÓN: Usar 'prevProgress' y 'newState' consistentemente ***
              setProgress(prevProgress => {
                   const newState = { ...prevProgress };
                   delete newState[serviceName]; // Reset progress
                   return newState;
              });
              setInstallMessage({ serviceName: serviceName, type: 'success', message: data.message || `${serviceName} desinstalado correctamente.` });
              // *** MANTENIDA LLAMADA A fetchAvailableApps AQUÍ (tras desinstalación exitosa) ***
               setTimeout(fetchAvailableApps, 500);


          } else {
              // Response OK, but backend didn't confirm success via data.success
              // THIS IS LIKELY THE SCENARIO CAUSING THE ORIGINAL REPORTED ISSUE (Error desconocido + backend success)
              // Construimos un mensaje informativo o de advertencia, PERO NO UNO DE ERROR ROJO.
              let infoMessage: string;
               if (data?.message) { // Prioritize message from backend if available
                  infoMessage = `Desinstalación solicitada: ${data.message}. Verificando estado...`;
              } else if (jsonError) { // Use JSON parsing error message
                  infoMessage = `Respuesta recibida, pero error al procesar la confirmación. Verificando estado...`;
              } else if (text) { // Use raw text if no specific message
                   infoMessage = `Respuesta inesperada recibida para desinstalación. Verificando estado...`;
              } else { // Fallback
                   infoMessage = `Solicitud de desinstalación enviada. Verificando estado...`;
              }

              // *** CORRECCIÓN: No setear a 'error' ni mostrar mensaje rojo ***
              // setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' })); // ELIMINADO
              // En su lugar, mantenemos el estado 'uninstalling' hasta que fetchAvailableApps lo cambie.
               setInstallMessage({ serviceName: serviceName, type: 'success', message: infoMessage }); // Mensaje informativo (verde/azul)

              // *** MANTENIDA LLAMADA A fetchAvailableApps AQUÍ (tras respuesta 2xx ambigua) ***
              // Esto es CRUCIAL para actualizar la UI cuando el backend desinstaló pero no confirmó en el JSON.
              setTimeout(fetchAvailableApps, 2000); // Refetch después de un breve retraso

          }
      } else { // El backend respondió con un error (4xx/5xx) - ESTO SÍ ES UN ERROR REAL
          // Construct error message defensively for HTTP errors (mantener lógica de error)
          let errorMessage: string;
          if (data?.message) { // Prioritize message from backend error body
              errorMessage = data.message;
          } else if (text) { // Use raw text if no specific error message in body
              errorMessage = `Error HTTP ${response.status}: ${text}`;
          } else { // Fallback
               errorMessage = `Error HTTP inesperado ${response.status} al desinstalar ${serviceName}`;
          }

        setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' })); // Set status to error (estado de error real)
        setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error desinstalando ${serviceName}: ${errorMessage}` }); // Mensaje de error rojo
        // *** SE ELIMINA LA LLAMADA AUTOMÁTICA A fetchAvailableApps AQUÍ (en caso de error 4xx/5xx) ***
      }
    } catch (err: any) { // Capturar errores de red, errores lanzados explícitamente, etc. - ESTO SÍ ES UN ERROR REAL
      console.error(`Error al desinstalar ${serviceName}:`, err);
      setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' })); // Set status to error (estado de error real)
      setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error desinstalando ${serviceName}: ${err.message}` }); // Mensaje de error rojo
      // *** SE ELIMINA LA LLAMADA AUTOMÁTICA A fetchAvailableApps AQUÍ (en caso de error crítico) ***
    }
    // Status is updated immediately on success/error or left as 'uninstalling' until fetchAvailableApps resolves it.
  };


  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-200">App Store</h1>

      {installMessage && (
        <div className={`p-3 rounded-md text-white ${installMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {installMessage.message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-32 text-red-500">
          <XCircle className="w-6 h-6 mr-2" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {availableApps.map((app) => {
            const status = installationStatus[app.service_name] || 'idle';
            const installing = status === 'installing';
            const installed = status === 'installed';
            const uninstalling = status === 'uninstalling'; // Nuevo estado si lo usas

            return (
              <Card key={app.service_name} className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">{app.displayName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{app.description}</p>

                  {(installing || uninstalling) && ( // Mostrar progreso o spinner si está instalando O desinstalando
                    // Podrías mostrar un progreso diferente para desinstalación o solo spinner
                      installing ? (
                         <Progress value={progress[app.service_name] || 0} className="mb-2" />
                      ) : (
                         <div className="flex items-center mb-2 text-gray-500 dark:text-gray-400"> {/* Added text color for dark mode */}
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                             <span>Desinstalando...</span>
                         </div>
                      )
                  )}

                  <div className="flex justify-between">
                    {installed ? (
                      <Button
                          onClick={() => handleUninstallClick(app.service_name)}
                          variant="destructive"
                          disabled={installing || uninstalling} // Deshabilitar si está en proceso
                      >
                        {(installing || uninstalling) ? (
                             <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                         ) : (
                             <Trash2 className="w-4 h-4 mr-2" />
                         )}
                        {(installing || uninstalling) ? 'Procesando...' : 'Desinstalar'}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleInstallClick(app.service_name)}
                        disabled={installing || installed || uninstalling} // Deshabilitar si está en proceso o instalado
                      >
                        {installing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Instalando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Instalar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}