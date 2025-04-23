'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, StopCircle, ExternalLink, CheckCircle2, XCircle, AlertCircle, Package } from 'lucide-react';


// --- Configuración - ¡VALORES HARDCODEADOS! ---
// !!! ADVERTENCIA DE SEGURIDAD: Hardcodear URLs aquí está bien si es una red privada interna sin acceso externo,
// pero usar variables de entorno cargadas de forma segura (sin NEXT_PUBLIC_) es preferible si la seguridad es crítica.
const BACKEND_API_BASE_URL = 'http://naspi.local:5000/api'; // URL del backend Flask
const NASPI_BASE_URL = 'http://naspi.local'; // URL base para acceder a los servicios (sin puerto ni /api)


// Mapa para nombres y descripciones amigables de los servicios (debería coincidir con el backend)
const serviceDisplayInfo: { [key: string]: { name: string; description: string } } = {
    jellyfin: { name: 'Jellyfin Media Server', description: 'Servidor multimedia para tu contenido.' },
    plex: { name: 'Plex Media Server', description: 'Organiza y transmite tu biblioteca multimedia.' },
    pihole: { name: 'Pi-hole', description: 'Bloqueador de publicidad a nivel de red.' },
    // Añade aquí otros servicios si los incluyes en el backend
};

// --- Tipos ---
interface ServiceStatus {
    service_name: string; // El nombre interno del servicio (e.g., "jellyfin")
    stack_name: string; // El nombre del stack en Portainer (e.g., "jellyfin-stack")
    stack_id: number | null; // El ID interno de Portainer (null si no está instalado)
    status: 'Not Installed' | 'Running' | 'Stopped' | 'Error/NoServices' | 'Error/Unknown'; // Estado reportado por el backend
    running_count: number; // Contenedores corriendo en el stack
    total_count: number; // Total de contenedores en el stack
    access_port?: string; // Puerto de acceso si está definido en el backend
    // --- CORRECCIÓN: Añadir propiedades displayName y description ---
    displayName: string;
    description: string;
    // --- FIN CORRECCIÓN ---
}

interface ServiceActionStatus {
    [serviceName: string]: 'idle' | 'pending' | 'success' | 'error';
}

interface NotificationProps {
    message: string;
    type: "success" | "error";
}

const Notification: React.FC<NotificationProps> = ({ message, type }) => (
    <div className={`fixed top-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white text-sm z-50
    ${type === "success" ? "bg-green-500" : "bg-red-500"}`}>
        {message}
    </div>
);


export default function Services() {
    // --- Estado ---
    const [servicesList, setServicesList] = useState<ServiceStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionStatus, setActionStatus] = useState<ServiceActionStatus>({});
    const [notification, setNotification] = useState<NotificationProps | null>(null);


    // --- Ayudante para mostrar notificaciones ---
    const showNotification = (message: string, type: "success" | "error") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };


    // --- Función para obtener la lista de servicios ---
    const fetchServices = async () => {
        // Mantener el estado de carga visible solo si no hay servicios ya mostrados
        if (servicesList.length === 0) {
            setLoading(true);
        }
        setError(null);
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/services`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Error HTTP ${response.status}: ${errorData.message || response.statusText}`);
            }
            const data = await response.json();
            if (data.success && Array.isArray(data.services)) {
                const knownServices = data.services.filter((s: any) => serviceDisplayInfo[s.service_name?.toLowerCase()]);

                 // Añadir display info a los servicios ANTES de guardarlos en el estado
                 const servicesWithDisplayInfo = knownServices.map((service: any) => { // Usar 'any' aquí para acceder a las propiedades del backend
                     const displayInfo = serviceDisplayInfo[service.service_name.toLowerCase()] || { name: service.service_name, description: 'No description available.' };
                     return {
                        ...service, // Copiar las propiedades existentes del backend
                        displayName: displayInfo.name,
                        description: displayInfo.description,
                     } as ServiceStatus; // Asegurarse de que el objeto final cumple la interfaz ServiceStatus
                 });

                setServicesList(servicesWithDisplayInfo);
            } else {
                setError("La respuesta del backend no tiene el formato esperado para la lista de servicios.");
                setServicesList([]);
            }
        } catch (err: any) {
            console.error("Error fetching services list:", err);
            setError(`No se pudo cargar la lista de servicios. Detalles: ${err.message}`);
            setServicesList([]);
        } finally {
            setLoading(false);
        }
    };


    // --- Manejador para iniciar un servicio ---
    const handleStartService = async (serviceName: string) => {
        setActionStatus(prev => ({ ...prev, [serviceName]: 'pending' }));
        setNotification(null);

        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/services/start/${serviceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                 setActionStatus(prev => ({ ...prev, [serviceName]: 'error' }));
                 showNotification(`Error al iniciar ${serviceDisplayInfo[serviceName]?.name || serviceName}: ${data.message || response.statusText}`, 'error');
                 console.error(`Start failed for ${serviceName}:`, data);
                 fetchServices(); // Refrescar la lista para ver el estado actual reportado por el backend
                 return;
            }

            if (data.success) {
                setActionStatus(prev => ({ ...prev, [serviceName]: 'success' }));
                showNotification(`${serviceDisplayInfo[serviceName]?.name || serviceName} orden de inicio enviada.`, 'success');
                console.log(`Start command sent for ${serviceName}:`, data.message);
                setTimeout(fetchServices, 3000);
            } else {
                 setActionStatus(prev => ({ ...prev, [serviceName]: 'error' }));
                 showNotification(`Fallo reportado al iniciar ${serviceDisplayInfo[serviceName]?.name || serviceName}: ${data.message || 'Error desconocido.'}`, 'error');
                 console.error(`Start reported failure for ${serviceName}:`, data);
                 fetchServices();
            }

        } catch (err: any) {
            console.error(`Network or unexpected error starting ${serviceName}:`, err);
            setActionStatus(prev => ({ ...prev, [serviceName]: 'error' }));
            showNotification(`Error de red al iniciar ${serviceDisplayInfo[serviceName]?.name || serviceName}.`, 'error');
            fetchServices();
        } finally {
             setActionStatus(prev => ({ ...prev, [serviceName]: 'idle' }));
        }
    };

    // --- Manejador para detener un servicio ---
    const handleStopService = async (serviceName: string) => {
         setActionStatus(prev => ({ ...prev, [serviceName]: 'pending' }));
         setNotification(null);

         try {
             const response = await fetch(`${BACKEND_API_BASE_URL}/services/stop/${serviceName}`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                 },
             });

             const data = await response.json();

             if (!response.ok) {
                  setActionStatus(prev => ({ ...prev, [serviceName]: 'error' }));
                  showNotification(`Error al detener ${serviceDisplayInfo[serviceName]?.name || serviceName}: ${data.message || response.statusText}`, 'error');
                  console.error(`Stop failed for ${serviceName}:`, data);
                  fetchServices();
                  return;
             }

             if (data.success) {
                 setActionStatus(prev => ({ ...prev, [serviceName]: 'success' }));
                 showNotification(`${serviceDisplayInfo[serviceName]?.name || serviceName} orden de detención enviada.`, 'success');
                 console.log(`Stop command sent for ${serviceName}:`, data.message);
                 setTimeout(fetchServices, 3000);
             } else {
                  setActionStatus(prev => ({ ...prev, [serviceName]: 'error' }));
                  showNotification(`Fallo reportado al detener ${serviceDisplayInfo[serviceName]?.name || serviceName}: ${data.message || 'Error desconocido.'}`, 'error');
                  console.error(`Stop reported failure for ${serviceName}:`, data);
                  fetchServices();
             }

         } catch (err: any) {
             console.error(`Network or unexpected error stopping ${serviceName}:`, err);
             setActionStatus(prev => ({ ...prev, [serviceName]: 'error' }));
             showNotification(`Error de red al detener ${serviceDisplayInfo[serviceName]?.name || serviceName}.`, 'error');
             fetchServices();
         } finally {
              setActionStatus(prev => ({ ...prev, [serviceName]: 'idle' }));
         }
    };

    // --- Manejador para acceder al servicio ---
    const handleAccessService = (service: ServiceStatus) => {
        if (service.status === 'Running' && service.access_port) {
            const accessUrl = `${NASPI_BASE_URL}:${service.access_port}`;
            window.open(accessUrl, '_blank');
        } else {
             showNotification(`No se puede acceder a ${service.displayName}: No está corriendo o no se conoce el puerto de acceso.`, 'error');
        }
    };


    // --- Efecto para cargar la lista de servicios inicialmente y establecer polling ---
    useEffect(() => {
        fetchServices();

        // Refrescar la lista periódicamente (polling)
        const interval = setInterval(fetchServices, 15000); // Refrescar cada 15 segundos

        // Limpiar el intervalo cuando el componente se desmonte
        return () => clearInterval(interval);

    }, []); // [] asegura que este efecto solo se ejecuta una vez al montar


    // --- Renderizado ---
    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Notificaciones */}
            {notification && <Notification message={notification.message} type={notification.type} />}

            {/* Encabezado */}
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-200">Servicios Instalados</h1>

            {/* Estado de carga o error */}
            {loading && servicesList.length === 0 && (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="ml-2 text-gray-600 dark:text-gray-400">Cargando estado de servicios...</p>
                </div>
            )}

            {error && (
                <div className="flex justify-center items-center h-32 text-red-500">
                    <XCircle className="w-6 h-6 mr-2" />
                    <p>Error: {error}</p>
                </div>
            )}

             {!loading && servicesList.length === 0 && !error && (
                  <div className="flex justify-center items-center h-32">
                      <p className="text-gray-600 dark:text-gray-400">No se encontraron servicios gestionados por este NAS.</p>
                  </div>
             )}


            {/* Lista de Servicios */}
            {!error && servicesList.length > 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                 {servicesList.map((service) => {
                     const actionState = actionStatus[service.service_name] || 'idle';
                     const isPending = actionState === 'pending';

                     // Determinar el color del estado y el icono
                     let statusColor = 'text-gray-500';
                     let StatusIcon = AlertCircle;
                     switch (service.status) {
                        case 'Running':
                            statusColor = 'text-green-500';
                            StatusIcon = CheckCircle2;
                            break;
                        case 'Stopped':
                            statusColor = 'text-red-500';
                            StatusIcon = StopCircle;
                            break;
                        case 'Not Installed':
                             statusColor = 'text-yellow-500';
                             StatusIcon = Package;
                             break;
                        case 'Error/NoServices':
                        case 'Error/Unknown':
                             statusColor = 'text-red-600';
                             StatusIcon = XCircle;
                             break;
                         default:
                             statusColor = 'text-gray-500';
                             StatusIcon = AlertCircle;
                     }


                     return (
                         <Card key={service.service_name} className="bg-white dark:bg-gray-800 shadow-lg">
                             <CardHeader>
                                 <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                                    <span className={`mr-2 ${statusColor}`}><StatusIcon className="w-5 h-5"/></span>
                                     {service.displayName}
                                 </CardTitle>
                                 <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                                    Estado: <span className={`${statusColor} font-semibold`}>{service.status}</span>
                                    {service.status !== 'Not Installed' && service.total_count !== undefined && (
                                        <span> ({service.running_count}/{service.total_count} contenedores)</span>
                                    )}
                                 </CardDescription>
                             </CardHeader>
                             <CardContent className="space-y-2">
                                 <p className="text-sm text-gray-700 dark:text-gray-300">{service.description}</p> {/* Usar service.description */}
                                 <div className="flex flex-wrap gap-2">
                                     {/* Botón Iniciar */}
                                     {(service.status === 'Stopped' || service.status === 'Error/NoServices' || service.status === 'Error/Unknown') && service.stack_id !== null && (
                                         <Button
                                             onClick={() => handleStartService(service.service_name)}
                                             disabled={isPending}
                                             size="sm"
                                         >
                                             {isPending && actionState === 'pending' ? (
                                                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                             ) : (
                                                 <Play className="w-4 h-4 mr-1" />
                                             )}
                                             Iniciar
                                         </Button>
                                     )}

                                     {/* Botón Detener */}
                                     {service.status === 'Running' && (
                                         <Button
                                             onClick={() => handleStopService(service.service_name)}
                                             disabled={isPending}
                                             size="sm"
                                             variant="destructive"
                                         >
                                            {isPending && actionState === 'pending' ? (
                                                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                             ) : (
                                                <StopCircle className="w-4 h-4 mr-1" />
                                             )}
                                             Apagar
                                         </Button>
                                     )}

                                     {/* Botón Acceder */}
                                     {service.status === 'Running' && service.access_port && (
                                          <a
                                              href={`${NASPI_BASE_URL}:${service.access_port}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8"
                                          >
                                              <ExternalLink className="w-4 h-4 mr-1" />
                                              Acceder
                                          </a>
                                     )}

                                     {/* El botón Desinstalar ha sido eliminado como solicitaste. */}

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