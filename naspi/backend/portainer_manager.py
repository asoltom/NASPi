# portainer_manager.py
import requests
import os
import time

class PortainerManager:
    def __init__(self, portainer_url, username, password, environment_id=1):
        self.portainer_url = portainer_url.rstrip('/')
        self.username = username
        self.password = password
        self.environment_id = environment_id
        self._jwt_token = None
        self._token_expiry = 0 # Unix timestamp

        # --- Docker Compose Definitions for the services ---
        self.service_compose_definitions = {
            "jellyfin": {
                "name": "jellyfin-stack",
                "compose": """
version: "3.5"
services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    network_mode: "host" # Using host mode for easy access, adjust if needed
    volumes:
      - jellyfin_config:/config
      - jellyfin_cache:/cache
      # Add volume mappings for your media libraries here:
      # - /path/to/your/movies:/media/movies:ro
      # - /path/to/your/tvshows:/media/tvshows:ro
    restart: unless-stopped
    environment:
      - PUID=1000 # Change to your user ID
      - PGID=1000 # Change to your group ID
      - TZ=Etc/UTC # Change to your timezone
volumes:
  jellyfin_config:
  jellyfin_cache:
"""
            },
            "plex": {
                 "name": "plex-stack",
                 "compose": """
version: "3.5"
services:
  plex:
    image: plexinc/pms-docker:latest
    container_name: plex
    network_mode: "host" # Using host mode for easy access, adjust if needed
    volumes:
      - plex_config:/config
      - plex_transcode:/transcode
      # Add volume mappings for your media libraries here:
      # - /path/to/your/movies:/data/movies:ro
      # - /path/to/your/tvshows:/data/tvshows:ro
    restart: unless-stopped
    environment:
      - PLEX_CLAIM= # Optional: Claim your server here: https://www.plex.tv/claim
      - PUID=1000 # Change to your user ID
      - PGID=1000 # Change to your group ID
      - TZ=Etc/UTC # Change to your timezone
volumes:
  plex_config:
  plex_transcode:
"""
            },
            "pihole": {
                 "name": "pihole-stack",
                 "compose": """
version: "3"
services:
  pihole:
    image: pihole/pihole:latest
    container_name: pihole
    # Use macvlan for a separate IP, or bridge + specific ports
    network_mode: "bridge" # Using bridge mode, exposing ports
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "67:67/udp" # Only required if using Pihole as DHCP server
      - "80:80/tcp" # Admin interface
    environment:
      - TZ=Etc/UTC # Change to your timezone
      - WEBPASSWORD=set_a_secure_password # !!! CHANGE THIS !!!
    volumes:
      - pihole_config:/etc/pihole/
      - pihole_dnsmasq:/etc/dnsmasq.d/
    # Recommended: Set Pihole's interface to the bridge interface (e.g. eth0)
    # volumes:
    #   - pihole_config:/etc/pihole/
    #   - pihole_dnsmasq:/etc/dnsmasq.d/
    # dns:
    #   - 127.0.0.1
    #   - 1.1.1.1 # Or other upstream DNS
    # Optional: Pihole will not start up if a random seed is not provided (requires "/dev/random" - Pihole v5.8+)
    # See https://docs.pi-hole.net/FTL/release-notes/#v58
    # If you have issues starting, try adding this:
    # cap_add:
    #   - NET_ADMIN
    restart: unless-stopped
volumes:
  pihole_config:
  pihole_dnsmasq:
"""
            }
        }
        self.known_service_names = list(self.service_compose_definitions.keys())


    def _get_headers(self):
        """Gets headers including the JWT token, refreshing if needed."""
        if self._jwt_token is None or self._token_expiry <= time.time():
            self._authenticate()
        return {
            "Authorization": f"Bearer {self._jwt_token}",
            "Content-Type": "application/json"
        }

    def _authenticate(self):
        """Authenticates with Portainer API and stores the token."""
        auth_url = f"{self.portainer_url}/api/auth"
        payload = {"username": self.username, "password": self.password}
        try:
            response = requests.post(auth_url, json=payload, verify=False)
            response.raise_for_status() # Raise an exception for bad status codes
            data = response.json()
            self._jwt_token = data["jwt"]
            # API tokens typically have an expiration, add a buffer
            # Portainer's default token expiry is usually 24 hours, but it's good practice
            # to implement a check or just re-authenticate on each API call if preferred for simplicity.
            # For this example, we'll assume the token is valid after getting it and re-auth when _get_headers checks.
            self._token_expiry = time.time() + (24 * 60 * 60) - 60 # Assume 24h validity, refresh 60s early

        except requests.exceptions.RequestException as e:
            print(f"Error authenticating with Portainer: {e}")
            self._jwt_token = None # Clear token on failure
            raise # Re-raise the exception

    def get_available_services(self):
        """Returns a list of service names that can be installed."""
        return self.known_service_names

    def install_service(self, service_name):
        """Deploys a service stack in Portainer."""
        if service_name not in self.service_compose_definitions:
            return {"success": False, "message": f"Service '{service_name}' definition not found."}, 404

        service_info = self.service_compose_definitions[service_name]
        stack_name = service_info["name"]
        compose_content = service_info["compose"]

        deploy_url = f"{self.portainer_url}/api/stacks?method=string&endpointId={self.environment_id}"
        payload = {
            "name": stack_name,
            "stackFileContent": compose_content
        }

        try:
            headers = self._get_headers()
            response = requests.post(deploy_url, headers=headers, json=payload, verify=False)
            response.raise_for_status() # Raise an exception for bad status codes

            # Check response - Portainer might return the created stack details
            return {"success": True, "message": f"Service '{service_name}' ({stack_name}) deployment initiated."}, 200

        except requests.exceptions.RequestException as e:
            print(f"Error deploying service '{service_name}' via Portainer API: {e}")
            # Try to provide more details from Portainer's response if available
            error_message = str(e)
            if hasattr(e, 'response') and e.response is not None:
                 try:
                     error_details = e.response.json()
                     if 'message' in error_details:
                          error_message = f"Portainer API error: {error_details['message']}"
                     elif 'error' in error_details:
                           error_message = f"Portainer API error: {error_details['error']}"
                 except:
                     pass # Ignore if response is not JSON

            return {"success": False, "message": f"Failed to deploy service '{service_name}'. Details: {error_message}"}, response.status_code if hasattr(e, 'response') and e.response is not None else 500


    def list_installed_services(self):
        """Lists the status of the known installed services by checking Portainer stacks."""
        list_url = f"{self.portainer_url}/api/stacks?endpointId={self.environment_id}"
        installed_services_status = []

        try:
            headers = self._get_headers()
            response = requests.get(list_url, headers=headers, verify=False)
            response.raise_for_status()
            all_stacks = response.json()

            # Map Portainer stack names back to our known service names
            stack_name_to_service_name = {v['name']: k for k, v in self.service_compose_definitions.items()}

            for stack in all_stacks:
                stack_name = stack.get('Name')
                stack_id = stack.get('Id')
                # Check if this stack corresponds to one of our known services
                if stack_name in stack_name_to_service_name:
                    service_name = stack_name_to_service_name[stack_name]
                    running_count = stack.get('Running') # Portainer often provides this summary in the stack list
                    total_count = stack.get('Services')
                    status = "Running" if running_count and running_count > 0 else "Stopped" if total_count and total_count > 0 else "Error/Unknown"
                    if total_count is None or total_count == 0: # Stack exists but has no services? Likely error.
                         status = "Error/NoServices"


                    installed_services_status.append({
                        "service_name": service_name,
                        "stack_name": stack_name,
                        "stack_id": stack_id,
                        "status": status, # Basic status check
                        # Add other relevant info like access URL/Port if you can derive it (hard from API alone, often manual config)
                    })

            # Also list services that are defined but NOT currently installed
            installed_stack_names = {s['stack_name'] for s in installed_services_status}
            for service_name, service_info in self.service_compose_definitions.items():
                 if service_info['name'] not in installed_stack_names:
                      installed_services_status.append({
                          "service_name": service_name,
                          "stack_name": service_info['name'],
                          "stack_id": None, # Not installed
                          "status": "Not Installed"
                      })


            return {"success": True, "services": installed_services_status}, 200

        except requests.exceptions.RequestException as e:
            print(f"Error listing stacks from Portainer API: {e}")
            error_message = str(e)
            if hasattr(e, 'response') and e.response is not None:
                 try:
                     error_details = e.response.json()
                     if 'message' in error_details:
                          error_message = f"Portainer API error: {error_details['message']}"
                     elif 'error' in error_details:
                           error_message = f"Portainer API error: {error_details['error']}"
                 except:
                     pass # Ignore if response is not JSON
            return {"success": False, "message": f"Failed to list services. Details: {error_message}"}, response.status_code if hasattr(e, 'response') and e.response is not None else 500

    def _get_stack_id_by_name(self, stack_name):
        """Helper to find a stack ID by its name."""
        list_url = f"{self.portainer_url}/api/stacks?endpointId={self.environment_id}"
        try:
            headers = self._get_headers()
            response = requests.get(list_url, headers=headers, verify=False)
            response.raise_for_status()
            all_stacks = response.json()
            for stack in all_stacks:
                if stack.get('Name') == stack_name:
                    return stack.get('Id')
            return None # Not found
        except requests.exceptions.RequestException as e:
            print(f"Error finding stack ID for '{stack_name}': {e}")
            return None # Error or not found

    def start_service(self, service_name):
        """Starts a service stack."""
        if service_name not in self.service_compose_definitions:
            return {"success": False, "message": f"Service '{service_name}' definition not found."}, 404

        stack_name = self.service_compose_definitions[service_name]["name"]
        stack_id = self._get_stack_id_by_name(stack_name)

        if stack_id is None:
            return {"success": False, "message": f"Service '{service_name}' ({stack_name}) not found as a stack."}, 404

        start_url = f"{self.portainer_url}/api/stacks/{stack_id}/start?endpointId={self.environment_id}"

        try:
            headers = self._get_headers()
            response = requests.post(start_url, headers=headers, verify=False)
            response.raise_for_status()
            return {"success": True, "message": f"Service '{service_name}' ({stack_name}) started."}, 200
        except requests.exceptions.RequestException as e:
            print(f"Error starting service '{service_name}' via Portainer API: {e}")
            error_message = str(e)
            if hasattr(e, 'response') and e.response is not None:
                 try:
                     error_details = e.response.json()
                     if 'message' in error_details:
                          error_message = f"Portainer API error: {error_details['message']}"
                     elif 'error' in error_details:
                           error_message = f"Portainer API error: {error_details['error']}"
                 except:
                     pass # Ignore if response is not JSON
            return {"success": False, "message": f"Failed to start service '{service_name}'. Details: {error_message}"}, response.status_code if hasattr(e, 'response') and e.response is not None else 500

    def stop_service(self, service_name):
        """Stops a service stack."""
        if service_name not in self.service_compose_definitions:
            return {"success": False, "message": f"Service '{service_name}' definition not found."}, 404

        stack_name = self.service_compose_definitions[service_name]["name"]
        stack_id = self._get_stack_id_by_name(stack_name)

        if stack_id is None:
             return {"success": False, "message": f"Service '{service_name}' ({stack_name}) not found as a stack."}, 404

        stop_url = f"{self.portainer_url}/api/stacks/{stack_id}/stop?endpointId={self.environment_id}"

        try:
            headers = self._get_headers()
            response = requests.post(stop_url, headers=headers, verify=False) # <--- Añadir verify=False aquí
            response.raise_for_status()
            return {"success": True, "message": f"Service '{service_name}' ({stack_name}) stopped."}, 200
        except requests.exceptions.RequestException as e:
            print(f"Error stopping service '{service_name}' via Portainer API: {e}")
            error_message = str(e)
            if hasattr(e, 'response') and e.response is not None:
                 try:
                     error_details = e.response.json()
                     if 'message' in error_details:
                          error_message = f"Portainer API error: {error_details['message']}"
                     elif 'error' in error_details:
                           error_message = f"Portainer API error: {error_details['error']}"
                 except:
                     pass # Ignore if response is not JSON
            return {"success": False, "message": f"Failed to stop service '{service_name}'. Details: {error_message}"}, response.status_code if hasattr(e, 'response') and e.response is not None else 500


# --- Example .env file ---
# PORTAINER_URL=http://your_portainer_ip:9000
# PORTAINER_USERNAME=your_portainer_user
# PORTAINER_PASSWORD=your_portainer_password
# PORTAINER_ENVIRONMENT_ID=1 # Check your Portainer setup, 1 is default for local environment

# --- Note on SSL Verification ---
# The 'verify=False' is added to requests.get/post calls.
# This is often necessary when Portainer is accessed via HTTPS on a local IP with a self-signed certificate.
# It disables SSL certificate verification.
# !!! WARNING: This makes your backend vulnerable to man-in-the-middle attacks if the network is NOT fully trusted.
# For a truly secure setup, you would need to configure proper SSL certificates and remove 'verify=False'.