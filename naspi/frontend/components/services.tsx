'use client'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, StopCircle, ExternalLink, CheckCircle2, XCircle, AlertCircle, Settings2 } from 'lucide-react';

const BACKEND_API_BASE_URL = '/api';

interface ServiceStatus {
    service_name: string;
    stack_name: string;
    stack_id: number | null;
    status: 'Not Installed' | 'Running' | 'Stopped' | 'Error/NoServices' | 'Error/Unknown';
    running_count: number;
    total_count: number;
    access_port?: string;
    displayName: string;
    description: string;
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

const serviceCustomRoutes: { [key: string]: string } = {
    plex: '/web',
    pihole: '/admin' // ← ruta correcta para acceder a la interfaz de Pi-hole
  };

export default function Services() {
    const [servicesList, setServicesList] = useState<ServiceStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<NotificationProps | null>(null);

    const showNotification = (message: string, type: "success" | "error") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const fetchServices = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/services`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Error HTTP ${response.status}: ${errorData.message || response.statusText}`);
            }
            const data = await response.json();
            if (data.success && Array.isArray(data.services)) {
                const fixedList = data.services.map((service: any) => {
                    let fixedStatus = service.status;
                    if ((fixedStatus === 'Error/Unknown' || fixedStatus === 'Error/NoServices') && service.stack_id !== null) {
                        fixedStatus = 'Running';
                    }
                    return {
                        ...service,
                        status: fixedStatus
                    } as ServiceStatus;
                });

                setServicesList(fixedList);
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

    const handleAccessService = (service: ServiceStatus, configMode = false) => {
        const NASPI_BASE_URL = `${window.location.protocol}//${window.location.hostname}`;
        
        if (service.status !== 'Running') {
          showNotification(`El servicio ${service.displayName} no está activo.`, 'error');
          return;
        }
      
        // Acceso personalizado para EmulatorJS
        if (service.service_name === 'emulatorjs') {
          const port = configMode ? '10000' : '10001';
          window.open(`${NASPI_BASE_URL}:${port}`, '_blank');
          return;
        }
      
        // Acceso con rutas personalizadas (como Pi-hole o Plex)
        const routeSuffix = serviceCustomRoutes[service.service_name] || '';
        if (service.access_port) {
          const accessUrl = `${NASPI_BASE_URL}:${service.access_port}${routeSuffix}`;
          window.open(accessUrl, '_blank');
        } else {
          showNotification(`No se ha definido el puerto de acceso para ${service.displayName}.`, 'error');
        }
      };

    useEffect(() => {
        fetchServices();
        const interval = setInterval(fetchServices, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-4 md:p-6 space-y-6">
            {notification && <Notification message={notification.message} type={notification.type} />}
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-200">Servicios Instalados</h1>

            {loading && servicesList.length === 0 && (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="ml-2 text-gray-600 dark:text-gray-400">Cargando estado de servicios...</p>
                </div>
            )}

            {error && (
                <div className="flex justify-center items-center h-32 text-red-500">
                    <XCircle className="w-6 h-6 mr-2" />
                    <p>{error}</p>
                </div>
            )}

            {!error && servicesList.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {servicesList.map((service) => (
                        <Card key={service.service_name} className="bg-white dark:bg-gray-800 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                                    <span className="mr-2">
                                        {service.status === 'Running'
                                            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            : <AlertCircle className="w-5 h-5 text-red-500" />}
                                    </span>
                                    {service.displayName}
                                </CardTitle>
                                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                                    Estado: <span className="font-semibold">{service.status}</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-sm text-gray-700 dark:text-gray-300">{service.description}</p>
                                {service.status === 'Running' && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button onClick={() => handleAccessService(service)} size="sm">
                                            <ExternalLink className="w-4 h-4 mr-2" /> Acceder
                                        </Button>
                                        {service.service_name === 'emulatorjs' && (
                                            <Button
                                                onClick={() => handleAccessService(service, true)}
                                                size="sm"
                                                className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                                            >
                                                <Settings2 className="w-4 h-4 mr-2" /> Configuración
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
