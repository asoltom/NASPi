# portainer_manager.py actualizado - incluye autenticación JWT y servicios

import requests
import os
import traceback
from dotenv import load_dotenv
import json # Importar el módulo json

env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

class PortainerManager:
    def __init__(self, portainer_url=None, username=None, password=None, environment_id=None):
        self.portainer_url = (portainer_url or os.getenv("PORTAINER_URL", "")).rstrip('/')
        self.environment_id = int(environment_id or os.getenv("PORTAINER_ENVIRONMENT_ID", 1))
        self.username = username or os.getenv("PORTAINER_USERNAME")
        self.password = password or os.getenv("PORTAINER_PASSWORD")

        if not all([self.username, self.password]):
            raise ValueError("Portainer username and password are required (from args or .env)")

        self._api_token = self._login_and_get_jwt(self.username, self.password)

        # La indentación en los compose strings ya debería estar corregida
        self.service_compose_definitions = {
            "jellyfin": {
                "name": "jellyfin-stack",
                "compose": """version: "3.9"
services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    network_mode: bridge
    ports:
      - "8096:8096"
      - "8920:8920"
    volumes:
      - jellyfin_config:/config
      - jellyfin_cache:/cache
      - /mnt/raid/files/peliculas:/media/movies:ro
      - /mnt/raid/files/series:/media/tvshows:ro
    restart: unless-stopped
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Madrid
volumes:
  jellyfin_config:
  jellyfin_cache:
"""
            },
            "plex": {
                "name": "plex-stack",
                "compose": """version: "3.9"
services:
  plex:
    image: plexinc/pms-docker:latest
    container_name: plex
    network_mode: host
    volumes:
      - plex_config:/config
      - plex_transcode:/transcode
      - /mnt/raid/files/peliculas:/data/movies:ro
      - /mnt/raid/files/series:/data/tvshows:ro
    restart: unless-stopped
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Madrid
      - PLEX_CLAIM=
volumes:
  plex_config:
  plex_transcode:
"""
            },
            "pihole": {
                "name": "pihole-stack",
                "compose": """version: "3.9"
services:
  pihole:
    image: pihole/pihole:latest
    container_name: pihole
    network_mode: bridge
    ports:
      - "5354:53/tcp"
      - "5354:53/udp"
      - "9000:80/tcp"
    volumes:
      - pihole_config:/etc/pihole/
      - pihole_dnsmasq:/etc/dnsmasq.d/
    environment:
      - TZ=Europe/Madrid
      - WEBPASSWORD=admin123
    dns:
      - 127.0.0.1
      - 1.1.1.1
    restart: unless-stopped
volumes:
  pihole_config:
  pihole_dnsmasq:
"""
            }
        }
        self.known_service_names = list(self.service_compose_definitions.keys())

    def _login_and_get_jwt(self, username, password):
        try:
            # Nota: verify=False deshabilita la verificación SSL y no es seguro en producción.
            response = requests.post(
                f"{self.portainer_url}/api/auth",
                json={"Username": username, "Password": password},
                verify=False
            )
            response.raise_for_status()
            return response.json()["jwt"]
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Failed to authenticate with Portainer API: {e}")

    def _get_headers(self):
        if not self._api_token:
            raise ValueError("JWT token not available. Make sure login succeeded.")
        return {
            "Authorization": f"Bearer {self._api_token}",
            "Content-Type": "application/json"
        }

    def get_available_services(self):
        try:
            # Obtener stacks actuales de Portainer
            stacks = self._list_stacks()
            installed_stack_names = [stack.get('Name') for stack in stacks]

            services_list = []
            for service_key, service_info in self.service_compose_definitions.items():
                stack_name = service_info["name"]
                installed = stack_name in installed_stack_names
                services_list.append({
                    "service_name": service_key,
                    "displayName": service_key.capitalize(),
                    "description": service_info.get("description", "No description available."),
                    "installed": installed
                })

            return {"success": True, "available_services": services_list}, 200
        except Exception as e:
            traceback.print_exc()
            return {"success": False, "message": str(e)}, 500

    def install_service(self, service_name):
        service_key = service_name.lower()
        if service_key not in self.service_compose_definitions:
            return {"success": False, "message": f"Service '{service_name}' not found."}, 404

        service = self.service_compose_definitions[service_key]
        stack_name = service["name"]
        compose_content = service["compose"]

        # Verificar si el stack ya existe usando el método con endpointId
        stacks = self._list_stacks()
        if any(stack.get('Name') == stack_name for stack in stacks): # Usar .get() para seguridad
            return {"success": False, "message": f"{service_key.capitalize()} ya parece estar instalado."}, 409

        # La URL ya incluía endpointId
        url = f"{self.portainer_url}/api/stacks/create/standalone/string?endpointId={self.environment_id}"
        payload = {
            "name": stack_name,
            "stackFileContent": compose_content
        }

        try:
            response = requests.post(url, headers=self._get_headers(), json=payload, verify=False)
            response.raise_for_status()
            return {"success": True, "message": f"Service '{service_name}' deployed successfully."}, response.status_code
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return {"success": False, "message": f"Error al desplegar el stack {stack_name}: {str(e)}"}, getattr(e.response, 'status_code', 500)


    def uninstall_service(self, service_name):
        service_key = service_name.lower()
        if service_key not in self.service_compose_definitions:
            return {"success": False, "message": f"Service '{service_name}' no reconocido."}, 404

        service = self.service_compose_definitions[service_key]
        stack_name = service["name"]

        # Buscar ID del stack en Portainer usando el método con endpointId
        stacks = self._list_stacks()
        matching_stacks = [s for s in stacks if s.get('Name') == stack_name] # Usar .get()

        if not matching_stacks:
            return {"success": False, "message": f"Service '{service_name}' no encontrado para eliminar."}, 404

        stack_id = matching_stacks[0].get('Id') # Usar .get()

        # La URL ya incluía endpointId
        try:
            url = f"{self.portainer_url}/api/stacks/{stack_id}?endpointId={self.environment_id}"
            response = requests.delete(url, headers=self._get_headers(), verify=False)
            response.raise_for_status()
            return {"success": True, "message": f"Service '{service_name}' eliminado correctamente."}, response.status_code
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return {"success": False, "message": f"Error al eliminar el stack {stack_name}: {str(e)}"}, getattr(e.response, 'status_code', 500)


    def _list_stacks(self):
        """
        Lista todos los stacks en el entorno especificado.
        Incluye endpointId en la URL.
        """
        try:
            # ADDED endpointId query parameter
            url = f"{self.portainer_url}/api/stacks?endpointId={self.environment_id}"
            # print(f"DEBUG: Calling _list_stacks URL: {url}") # Debugging line opcional
            response = requests.get(url, headers=self._get_headers(), verify=False)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            print(f"Warning: Could not list stacks from Portainer (endpoint {self.environment_id}): {e}")
            return []

    def _list_containers_in_stack(self, stack_id):
         """
         Lista contenedores pertenecientes a un stack por ID en el entorno especificado.
         Incluye endpointId en la URL.
         """
         try:
             # Filter by stack ID AND ADD endpointId query parameter
             # Note: Portainer API filters are usually JSON *stringified* in the query param
             filters = {"stackId": str(stack_id)} # Ensure stackId is a string for the filter JSON
             encoded_filters = requests.utils.quote(json.dumps(filters)) # json.dumps convierte el dict a string, quote lo codifica para la URL
             url = f"{self.portainer_url}/api/containers?filters={encoded_filters}&endpointId={self.environment_id}" # ADDED endpointId

             # print(f"DEBUG: Calling _list_containers_in_stack URL: {url}") # Debugging line opcional
             response = requests.get(url, headers=self._get_headers(), verify=False)
             response.raise_for_status()
             return response.json()
         except requests.exceptions.RequestException as e:
             traceback.print_exc()
             print(f"Warning: Could not list containers for stack {stack_id} (endpoint {self.environment_id}): {e}")
             return []

    def list_installed_services(self):
        """
        Lista los servicios definidos que están instalados en Portainer y su estado.
        Intenta obtener el estado y conteo de contenedores.
        """
        try:
            # 1. Obtener todos los stacks de Portainer (ahora con endpointId)
            all_stacks = self._list_stacks()
            # Filtrar solo los stacks que corresponden a nuestros servicios definidos
            installed_stacks = {
                 stack.get('Name'): stack for stack in all_stacks
                 if stack.get('Name') in [s['name'] for s in self.service_compose_definitions.values()]
            }

            # 2. Preparar la lista de estados para el frontend
            services_status_list = []

            # Iterar sobre nuestros servicios definidos
            for service_key, service_info in self.service_compose_definitions.items():
                stack_name = service_info["name"]
                stack = installed_stacks.get(stack_name)

                status = 'Not Installed' # Estado por defecto si el stack no se encuentra
                stack_id = None
                running_count = 0
                total_count = 0
                access_port = self._get_access_port_for_service(service_key, None) # Intentar obtener puerto aunque no tengamos contenedores aún

                if stack: # Si el stack fue encontrado en Portainer
                    stack_id = stack.get('Id')

                    # Obtener contenedores para este stack (ahora con endpointId)
                    containers = self._list_containers_in_stack(stack_id)

                    # Contar contenedores
                    running_containers = [c for c in containers if 'running' in c.get('Status', '').lower()]
                    running_count = len(running_containers)
                    total_count = len(containers)

                    # Determinar el estado basado en el conteo de contenedores
                    if total_count > 0:
                        status = 'Running' if running_count > 0 else 'Stopped'
                    else:
                        raw_status_from_stack = stack.get('Status')
                        if raw_status_from_stack is not None:
                             # Si Portainer proporciona un Status en el objeto stack (como el '1' numérico)
                             # Decidimos qué estado de string mapea.
                             if raw_status_from_stack == 1:
                                 status = 'Error/Unknown' # O 'Error/FailedDeployment' si sabes qué significa 1
                             else:
                                 # Para otros valores inesperados o si Portainer usa strings aquí a veces
                                 status = str(raw_status_from_stack) # Convertir a string para el frontend
                        else:
                             # Si no hay Status en el objeto stack y no hay contenedores
                             status = 'Error/NoServices' # O 'Stopped' si asumes que un stack sin contenedores es detenido

                # Mapear a la estructura ServiceStatus que espera el frontend
                services_status_list.append({
                    "service_name": service_key,
                    "stack_name": stack_name,
                    "stack_id": stack_id,
                    "status": status, # El estado determinado (debería ser un string)
                    "running_count": running_count,
                    "total_count": total_count,
                    "access_port": access_port, # O el puerto real si puedes obtenerlo
                    # Usamos info del service_compose_definitions o valores por defecto
                    "displayName": service_info.get("name", service_key.capitalize()),
                    "description": service_info.get("description", "No description available."),
                })

            # El frontend espera la clave "services" con la lista de estados
            return {"success": True, "services": services_status_list}, 200

        except Exception as e:
            traceback.print_exc()
            # Si ocurre *cualquier* error al listar (ej. error de red al llamar a Portainer API)
            return {"success": False, "message": f"Error al listar servicios de Portainer: {str(e)}"}, 500


    def _get_access_port_for_service(self, service_key, containers_in_stack):
        """
        Intenta encontrar el puerto de acceso para un servicio dado.
        ACTUALMENTE USA UN MAPEO HARDCODEADO. Para más precisión, necesitaría
        analizar los datos de 'ports' en los diccionarios de 'containers_in_stack'.
        """
        port_mapping = {
            "jellyfin": "8096",
            "plex": "32400", # Plex suele usar el host network, pero este es un puerto común
            "pihole": "9000", # Puerto web si usas 9000:80
        }
        # Idealmente, buscarías en containers_in_stack[i]['Ports'] para obtener el HostPort
        # que mapea al ContainerPort relevante (ej. 8096 para jellyfin).
        # Esto requiere lógica adicional y saber qué puerto interno usa cada servicio.
        return port_mapping.get(service_key) # Devuelve el puerto hardcodeado o None si no está mapeado

    def start_service(self, service_name):
        """
        Inicia un stack en Portainer. Implementación pendiente.
        """
        service_key = service_name.lower()
        # Necesitas encontrar el stack_id (usando _list_stacks y buscando por nombre)
        # Luego llamar a la API de Portainer POST /api/stacks/{id}/start?endpointId={env_id}
        print(f"DEBUG: start_service llamado para {service_name} - IMPLEMENTACIÓN PENDIENTE")
        return {"success": False, "message": "Función start_service no implementada en backend."}, 501 # Not Implemented

    def stop_service(self, service_name):
        """
        Detiene un stack en Portainer. Implementación pendiente.
        """
        service_key = service_name.lower()
        # Necesitas encontrar el stack_id (usando _list_stacks y buscando por nombre)
        # Luego llamar a la API de Portainer POST /api/stacks/{id}/stop?endpointId={env_id}
        print(f"DEBUG: stop_service llamado para {service_name} - IMPLEMENTACIÓN PENDIENTE")
        return {"success": False, "message": "Función stop_service no implementada en backend."}, 501 # Not Implemented


# Bloque de prueba manual (no se ejecuta cuando el módulo es importado)
if __name__ == '__main__':
    # Prueba manual
    PORTAINER_URL = os.getenv("PORTAINER_URL")
    USERNAME = os.getenv("PORTAINER_USERNAME")
    PASSWORD = os.getenv("PORTAINER_PASSWORD")
    # Usar un ID de entorno por defecto si no está en .env
    ENVIRONMENT_ID = os.getenv("PORTAINER_ENVIRONMENT_ID", "1") # Mejor leerlo como string inicialmente

    if not all([PORTAINER_URL, USERNAME, PASSWORD]):
        print("ERROR: Faltan PORTAINER_URL, USERNAME o PASSWORD en .env")
    else:
        try:
            # Intentar convertir ENVIRONMENT_ID a int, manejar si falla
            try:
                env_id = int(ENVIRONMENT_ID)
            except ValueError:
                 print(f"ERROR: PORTAINER_ENVIRONMENT_ID '{ENVIRONMENT_ID}' no es un número válido.")
                 exit()

            manager = PortainerManager(PORTAINER_URL, USERNAME, PASSWORD, env_id)
            print("\n--- Servicios Disponibles (definidos en backend) ---")
            available_result, status_code = manager.get_available_services()
            print(f"Status: {status_code}, Resultado: {available_result}")

            print("\n--- Estado de servicios instalados (de Portainer) ---")
            installed_status_result, installed_status_code = manager.list_installed_services()
            print(f"Status: {installed_status_code}, Resultado: {installed_status_result}")

        except RuntimeError as e:
             print(f"Error al inicializar PortainerManager: {e}")
        except Exception as e:
             print(f"Ocurrió un error inesperado: {e}")
             traceback.print_exc()