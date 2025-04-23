'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const BACKEND_API_BASE_URL = 'http://naspi.local:5000/api';
const ADMIN_API_KEY = 'YOUR_HARDCODED_ADMIN_API_KEY_HERE'; // !!! REEMPLAZA ESTO CON TU CLAVE REAL !!!

// Mapa para nombres y descripciones amigables de los servicios (basado en las claves de tu backend)
const serviceDisplayInfo: { [key: string]: { name: string; description: string } } = {
    jellyfin: { name: 'Jellyfin Media Server', description: 'Servidor multimedia para tu contenido.' },
    plex: { name: 'Plex Media Server', description: 'Organiza y transmite tu biblioteca multimedia.' },
    pihole: { name: 'Pi-hole', description: 'Bloqueador de publicidad a nivel de red.' },
    // Añade aquí otros servicios si los incluyes en el backend
};

// Tipo para un servicio disponible
interface AvailableService {
    name: string; // El nombre interno del servicio (e.g., "jellyfin")
    displayName: string; // Nombre amigable para mostrar
    description: string; // Descripción amigable
}

// Tipo para rastrear el estado de instalación en el frontend
interface InstallationStatus {
    [serviceName: string]: 'idle' | 'installing' | 'success' | 'error';
}

export default function AppStore() {

    const [availableApps, setAvailableApps] = useState<AvailableService[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installationStatus, setInstallationStatus] = useState<InstallationStatus>({});
    const [installMessage, setInstallMessage] = useState<{ serviceName: string; type: 'success' | 'error'; message: string } | null>(null);

    // Efecto para cargar la lista de apps disponibles al montar el componente
    useEffect(() => {
        const fetchAvailableApps = async () => {
            setLoading(true);
            setError(null);

            // !!! Verificar si la clave API ha sido REEMPLAZADA del placeholder (básico) !!!
            if (ADMIN_API_KEY === 'YOUR_HARDCODED_ADMIN_API_KEY_HERE') {
                 const configErrorMsg = "Error de configuración: La clave ADMIN_API_KEY no ha sido reemplazada en el código.";
                 setError(configErrorMsg);
                 setLoading(false);
                 console.error(configErrorMsg);
                 return;
            }

            try {
                const response = await fetch(`${BACKEND_API_BASE_URL}/admin/available-services`, {
                    method: 'GET',
                    headers: {
                        'X-Admin-API-Key': ADMIN_API_KEY, // Enviar la clave API en el encabezado
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: response.statusText }));
                    // Si el backend devuelve un error 401 (No autorizado), mostrar un mensaje específico
                    if (response.status === 401) {
                        throw new Error("Error de Autenticación: Clave Admin API incorrecta o no reconocida por el backend. Revisa tu clave en el código y en el .env del backend.");
                    }
                    throw new Error(`Error HTTP ${response.status}: ${errorData.message || response.statusText}`);
                }

                const data = await response.json();

                if (data.success && Array.isArray(data.available_services)) {
                    const apps = data.available_services.map((serviceName: string) => {
                        const displayInfo = serviceDisplayInfo[serviceName.toLowerCase()] || { name: serviceName, description: 'No description available.' };
                        return {
                            name: serviceName.toLowerCase(),
                            displayName: displayInfo.name,
                            description: displayInfo.description,
                        };
                    });
                    setAvailableApps(apps);
                } else {
                    setError("La respuesta del backend no tiene el formato esperado para la lista de servicios.");
                }

            } catch (err: any) {
                console.error("Error fetching available apps:", err);
                setError(`No se pudieron cargar las aplicaciones disponibles. Detalles: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchAvailableApps();

        // Limpiar el mensaje de instalación después de un tiempo
        const timer = setTimeout(() => {
             setInstallMessage(null);
        }, 5000); // Mensaje visible por 5 segundos

        return () => clearTimeout(timer);

    }, [installMessage]); // Dependencias: re-ejecutar solo cuando el mensaje de instalación cambia (para limpiar)

    // --- Manejador para el botón Instalar ---
    const handleInstallClick = async (serviceName: string) => {
        // !!! Verificar si la clave API ha sido REEMPLAZADA del placeholder (básico) !!!
        if (ADMIN_API_KEY === 'YOUR_HARDCODED_ADMIN_API_KEY_HERE') {
             setInstallMessage({ serviceName: serviceName, type: 'error', message: 'Error de configuración: Clave ADMIN_API_KEY no ha sido reemplazada.' });
             console.error("ADMIN_API_KEY not replaced");
             return;
        }


        setInstallationStatus(prev => ({ ...prev, [serviceName]: 'installing' }));
        setInstallMessage(null); // Limpiar mensajes anteriores

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/admin/install/${serviceName}`, {
                method: 'POST',
                headers: {
                    'X-Admin-API-Key': ADMIN_API_KEY, // Enviar la clave API
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                 setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' }));
                  // Si el backend devuelve un error 401 (No autorizado), mostrar un mensaje específico
                 if (response.status === 401) {
                     setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error al instalar ${serviceName}: Clave Admin API incorrecta.` });
                 } else if (response.status === 409) {
                     // Código 409 Conflict: Probablemente ya está instalado (según lógica del backend)
                     setInstallMessage({ serviceName: serviceName, type: 'error', message: `${serviceDisplayInfo[serviceName]?.name || serviceName} ya parece estar instalado.` });
                 }
                 else {
                    setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error ${response.status} al instalar ${serviceName}: ${data.message || response.statusText}` });
                 }
                 console.error(`Install failed for ${serviceName}:`, data);
                 return;
            }

            if (data.success) {
                setInstallationStatus(prev => ({ ...prev, [serviceName]: 'success' }));
                setInstallMessage({ serviceName: serviceName, type: 'success', message: `${serviceDisplayInfo[serviceName]?.name || serviceName} orden de instalación enviada.` });
                console.log(`Installation initiated for ${serviceName}:`, data.message);
            } else {
                 setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' }));
                 setInstallMessage({ serviceName: serviceName, type: 'error', message: `Fallo reportado al instalar ${serviceName}: ${data.message || 'Error desconocido.'}` });
                 console.error(`Install reported failure for ${serviceName}:`, data);
            }

        } catch (err: any) {
            console.error(`Error de red o inesperado al instalar ${serviceName}:`, err);
            setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' }));
            setInstallMessage({ serviceName: serviceName, type: 'error', message: `Error de conexión al instalar ${serviceName}. Detalles: ${err.message}` });
        } finally {
            // Decide how long the 'installing' state should persist,
            // or if 'success'/'error' states are enough until a page refresh.
        }
    };

    // --- Renderizado ---
    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-200">App Store</h1>
                <div className="flex w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Search apps..."
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-r-none md:w-64"
                  />
                  <Button className="rounded-l-none" variant="secondary">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
            </div>

            {/* Área para mostrar mensajes de instalación */}
            {installMessage && (
                <div className={`p-3 rounded-md text-white ${installMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {installMessage.message}
                </div>
            )}

            {/* Estado de carga, error o lista de apps */}
            {loading && (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="ml-2 text-gray-600 dark:text-gray-400">Cargando aplicaciones disponibles...</p>
                </div>
            )}

            {error && (
                <div className="flex justify-center items-center h-32 text-red-500">
                    <XCircle className="w-6 h-6 mr-2" />
                    <p>Error: {error}</p>
                </div>
            )}

            {!loading && !error && availableApps.length === 0 && (
                 <div className="flex justify-center items-center h-32">
                     <p className="text-gray-600 dark:text-gray-400">No se encontraron aplicaciones disponibles.</p>
                 </div>
            )}

            {!loading && !error && availableApps.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {availableApps.map((app) => {
                        const currentInstallStatus = installationStatus[app.name] || 'idle';
                        const isInstalling = currentInstallStatus === 'installing';
                        // No tenemos un estado "instalado" real aquí, solo si la orden se envió con éxito
                        const isOrderSentSuccessfully = currentInstallStatus === 'success';

                        return (
                            <Card key={app.name} className="bg-white dark:bg-gray-800">
                                <CardHeader>
                                    <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">{app.displayName}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{app.description}</p>
                                    <div className="flex justify-between items-center">
                                        {/* Botón de Instalar */}
                                        <Button
                                            onClick={() => handleInstallClick(app.name)}
                                            disabled={isInstalling || isOrderSentSuccessfully} // Deshabilitar si se está instalando o si la orden ya se envió con éxito
                                        >
                                            {isInstalling ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Instalando...
                                                </>
                                            ) : isOrderSentSuccessfully ? (
                                                 <>
                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                    Orden Enviada
                                                 </>
                                            ) : (
                                                <>
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Install
                                                </>
                                            )}
                                        </Button>
                                        {/* Botones de gestión (Iniciar/Detener/Desinstalar) irían en la página de servicios instalados */}
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