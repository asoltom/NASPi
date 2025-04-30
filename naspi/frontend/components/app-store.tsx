'use client'

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, XCircle, Trash2 } from 'lucide-react';

const BACKEND_API_BASE_URL = 'http://naspi.local:5000/api';
const ADMIN_API_KEY = "d9Kj@fPzW%x$3sVbL!gT&cQ#mN*hYu0eR1I_aZ2oJl4iKy5Rw6P7sV8";

interface AvailableService {
  service_name: string;
  displayName: string;
  description: string;
  installed: boolean;
}

interface InstallationStatus {
  [serviceName: string]: 'idle' | 'installing' | 'installed' | 'error' | 'uninstalling';
}

export default function AppStore() {
  const [availableApps, setAvailableApps] = useState<AvailableService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installationStatus, setInstallationStatus] = useState<InstallationStatus>({});
  const [installMessage, setInstallMessage] = useState<{ serviceName: string; type: 'success' | 'error'; message: string } | null>(null);
  const [progress, setProgress] = useState<{ [serviceName: string]: number }>({});

  const fetchAvailableApps = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_API_BASE_URL}/admin/available-services`, {
        method: 'GET',
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.available_services)) {
        const apps = data.available_services.map((app: any) => ({
          service_name: app.service_name,
          displayName: app.displayName || app.service_name,
          description: app.description || 'Sin descripción disponible.',
          installed: app.installed,
        }));

        setAvailableApps(apps);

        const initialStatus: InstallationStatus = {};
        apps.forEach((app: AvailableService) => {
          initialStatus[app.service_name] = app.installed ? 'installed' : 'idle';
        });
        setInstallationStatus(initialStatus);
      } else {
        setError(data.message || "Formato inesperado en la respuesta del backend.");
      }
    } catch (err: any) {
      console.error("Error fetching apps:", err);
      setError(`Error cargando apps: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableApps();
  }, [fetchAvailableApps]);

  const handleInstallClick = async (serviceName: string) => {
    setInstallationStatus(prev => ({ ...prev, [serviceName]: 'installing' }));
    setProgress(prev => ({ ...prev, [serviceName]: 0 }));
    setInstallMessage(null);

    try {
      const response = await fetch(`${BACKEND_API_BASE_URL}/admin/install/${serviceName}`, {
        method: 'POST',
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error en la instalación.');
      }

      simulateProgress(serviceName);
    } catch (err: any) {
      console.error(`Error al instalar ${serviceName}:`, err);
      setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' }));
      setInstallMessage({ serviceName, type: 'error', message: `Error instalando ${serviceName}: ${err.message}` });
    }
  };

  const handleUninstallClick = async (serviceName: string) => {
    setInstallationStatus(prev => ({ ...prev, [serviceName]: 'uninstalling' }));
    setInstallMessage(null);

    try {
      const response = await fetch(`${BACKEND_API_BASE_URL}/admin/uninstall/${serviceName}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-API-Key': ADMIN_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error en la desinstalación.');
      }

      setTimeout(fetchAvailableApps, 1000);
    } catch (err: any) {
      console.error(`Error al desinstalar ${serviceName}:`, err);
      setInstallationStatus(prev => ({ ...prev, [serviceName]: 'error' }));
      setInstallMessage({ serviceName, type: 'error', message: `Error desinstalando ${serviceName}: ${err.message}` });
    }
  };

  const simulateProgress = (serviceName: string) => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 20;
      setProgress(prev => ({ ...prev, [serviceName]: Math.min(currentProgress, 100) }));

      if (currentProgress >= 100) {
        clearInterval(interval);
        fetchAvailableApps();
      }
    }, 300);
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
          {availableApps.map(app => {
            const status = installationStatus[app.service_name] || 'idle';
            const installing = status === 'installing';
            const uninstalling = status === 'uninstalling';
            const installed = status === 'installed';

            return (
              <Card key={app.service_name} className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-medium">{app.displayName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{app.description}</p>

                  {(installing || uninstalling) && (
                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>{installing ? 'Instalando...' : 'Desinstalando...'}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {installed ? (
                      <Button
                        onClick={() => handleUninstallClick(app.service_name)}
                        variant="destructive"
                        size="sm"
                        disabled={installing || uninstalling}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {uninstalling ? 'Procesando...' : 'Desinstalar'}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleInstallClick(app.service_name)}
                        size="sm"
                        disabled={installing || uninstalling}
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
