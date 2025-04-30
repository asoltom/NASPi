import os
import json
import traceback
import requests
from dotenv import load_dotenv
import stat  # 👈 necesario para chmod 777

# Cargar .env
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

class PortainerManager:
    def __init__(self, portainer_url=None, username=None, password=None, environment_id=None):
        self.portainer_url = (portainer_url or os.getenv("PORTAINER_URL", "")).rstrip('/')
        self.environment_id = int(environment_id or os.getenv("PORTAINER_ENVIRONMENT_ID", 1))
        self.username = username or os.getenv("PORTAINER_USERNAME")
        self.password = password or os.getenv("PORTAINER_PASSWORD")
        self._api_token = self._login_and_get_jwt(self.username, self.password)
        
        services_path = os.path.join(os.path.dirname(__file__), "data", "services.json")
        if not os.path.exists(services_path):
            raise FileNotFoundError(f"services.json no encontrado en {services_path}")

        with open(services_path, 'r', encoding='utf-8') as f:
            self.service_compose_definitions = json.load(f)

        self.known_service_names = list(self.service_compose_definitions.keys())

    def _login_and_get_jwt(self, username, password):
        try:
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

    def _list_stacks(self):
        try:
            url = f"{self.portainer_url}/api/stacks?endpointId={self.environment_id}"
            response = requests.get(url, headers=self._get_headers(), verify=False)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return []

    def _list_containers_in_stack(self, stack_id):
        try:
            filters = {"stackId": str(stack_id)}
            encoded_filters = requests.utils.quote(json.dumps(filters))
            url = f"{self.portainer_url}/api/containers?filters={encoded_filters}&endpointId={self.environment_id}"
            response = requests.get(url, headers=self._get_headers(), verify=False)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return []

    def _ensure_volume_permissions(self, service_key):
        try:
            service = self.service_compose_definitions.get(service_key)
            if not service:
                return
            for line in service["compose"].splitlines():
                if line.strip().startswith("- /mnt/raid/files"):
                    host_path = line.strip().split(":")[0].strip().strip('"')
                    if os.path.exists(host_path):
                        os.chmod(host_path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)  # 0o777
                    else:
                        os.makedirs(host_path, exist_ok=True)
                        os.chmod(host_path, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
        except Exception as e:
            print(f"[WARN] No se pudo establecer permisos para {service_key}: {e}")

    def get_available_services(self):
        try:
            stacks = self._list_stacks()
            installed_stack_names = [stack.get('Name') for stack in stacks]
            services_list = []
            for service_key, service_info in self.service_compose_definitions.items():
                installed = service_info.get("name") in installed_stack_names
                services_list.append({
                    "service_name": service_key,
                    "displayName": service_info.get("displayName", service_key.capitalize()),
                    "description": service_info.get("description", "No description available."),
                    "installed": installed
                })
            return {"success": True, "available_services": services_list}, 200
        except Exception as e:
            traceback.print_exc()
            return {"success": False, "message": str(e)}, 500

    def install_service(self, service_name):
        try:
            service_info = self.service_compose_definitions.get(service_name)
            if not service_info:
                return {"success": False, "message": f"Servicio {service_name} no encontrado."}, 404
            stacks = self._list_stacks()
            if any(stack.get('Name') == service_info["name"] for stack in stacks):
                return {"success": False, "message": f"Servicio {service_name} ya está instalado."}, 409
            url = f"{self.portainer_url}/api/stacks/create/standalone/string?endpointId={self.environment_id}"
            payload = {
                "name": service_info["name"],
                "stackFileContent": service_info["compose"]
            }
            response = requests.post(url, headers=self._get_headers(), json=payload, verify=False)
            response.raise_for_status()
            self._ensure_volume_permissions(service_name)  # 👈 Permisos tras instalación
            return {"success": True, "message": f"Servicio {service_name} instalado correctamente."}, response.status_code
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return {"success": False, "message": str(e)}, getattr(e.response, 'status_code', 500)

    def uninstall_service(self, service_name):
        try:
            service_info = self.service_compose_definitions.get(service_name)
            if not service_info:
                return {"success": False, "message": f"Servicio {service_name} no encontrado."}, 404
            stacks = self._list_stacks()
            matching_stacks = [s for s in stacks if s.get('Name') == service_info["name"]]
            if not matching_stacks:
                return {"success": False, "message": f"Servicio {service_name} no encontrado en Portainer."}, 404
            stack_id = matching_stacks[0].get('Id')
            url = f"{self.portainer_url}/api/stacks/{stack_id}?endpointId={self.environment_id}"
            response = requests.delete(url, headers=self._get_headers(), verify=False)
            response.raise_for_status()
            return {"success": True, "message": f"Servicio {service_name} eliminado correctamente."}, response.status_code
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return {"success": False, "message": str(e)}, getattr(e.response, 'status_code', 500)

    def list_installed_services(self):
        try:
            all_stacks = self._list_stacks()
            installed_stacks = {
                stack.get('Name'): stack for stack in all_stacks
                if stack.get('Name') in [s['name'] for s in self.service_compose_definitions.values()]
            }
            services_status_list = []
            for service_key, service_info in self.service_compose_definitions.items():
                stack_name = service_info["name"]
                stack = installed_stacks.get(stack_name)
                status = 'Not Installed'
                stack_id = None
                running_count = 0
                total_count = 0
                access_port = service_info.get("access_port")
                if stack:
                    stack_id = stack.get('Id')
                    containers = self._list_containers_in_stack(stack_id)
                    running_containers = [c for c in containers if 'running' in c.get('Status', '').lower()]
                    running_count = len(running_containers)
                    total_count = len(containers)
                    if total_count > 0:
                        status = 'Running' if running_count > 0 else 'Stopped'
                    else:
                        raw_status = stack.get('Status')
                        status = 'Error/Unknown' if raw_status == 1 else 'Error/NoServices'
                services_status_list.append({
                    "service_name": service_key,
                    "stack_name": stack_name,
                    "stack_id": stack_id,
                    "status": status,
                    "running_count": running_count,
                    "total_count": total_count,
                    "access_port": access_port,
                    "displayName": service_info.get("displayName", service_key.capitalize()),
                    "description": service_info.get("description", "No description available.")
                })
            return {"success": True, "services": services_status_list}, 200
        except Exception as e:
            traceback.print_exc()
            return {"success": False, "message": f"Error al listar servicios: {str(e)}"}, 500

    def start_service(self, service_name):
        try:
            service_info = self.service_compose_definitions.get(service_name)
            if not service_info:
                return {"success": False, "message": f"Servicio {service_name} no encontrado."}, 404
            stacks = self._list_stacks()
            matching_stack = next((s for s in stacks if s.get('Name') == service_info["name"]), None)
            if not matching_stack:
                return {"success": False, "message": f"Stack para {service_name} no encontrado."}, 404
            stack_id = matching_stack.get('Id')
            url = f"{self.portainer_url}/api/stacks/{stack_id}/start?endpointId={self.environment_id}"
            response = requests.post(url, headers=self._get_headers(), verify=False)
            response.raise_for_status()
            return {"success": True, "message": f"Servicio {service_name} iniciado correctamente."}, response.status_code
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return {"success": False, "message": f"Error al iniciar servicio: {str(e)}"}, getattr(e.response, 'status_code', 500)

    def stop_service(self, service_name):
        try:
            service_info = self.service_compose_definitions.get(service_name)
            if not service_info:
                return {"success": False, "message": f"Servicio {service_name} no encontrado."}, 404
            stacks = self._list_stacks()
            matching_stack = next((s for s in stacks if s.get('Name') == service_info["name"]), None)
            if not matching_stack:
                return {"success": False, "message": f"Stack para {service_name} no encontrado."}, 404
            stack_id = matching_stack.get('Id')
            url = f"{self.portainer_url}/api/stacks/{stack_id}/stop?endpointId={self.environment_id}"
            response = requests.post(url, headers=self._get_headers(), verify=False)
            response.raise_for_status()
            return {"success": True, "message": f"Servicio {service_name} detenido correctamente."}, response.status_code
        except requests.exceptions.RequestException as e:
            traceback.print_exc()
            return {"success": False, "message": f"Error al detener servicio: {str(e)}"}, getattr(e.response, 'status_code', 500)
