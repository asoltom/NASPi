#-----------------------------------------------------------------------------------------------------------------------------------
# Autor: Arnau Soler Tomás
# Fichero: info_checker.py
# Descripción: Fichero en el que se incluyen funciones para recabar información acerca del sistema (Host, IP, CPU, RAM, Disk)
#-----------------------------------------------------------------------------------------------------------------------------------
#Librerias
import socket
import psutil
import shutil
#-----------------------------------------------------------------------------------------------------------------------------------
# Variables Globales

RAID_PATH = "/mnt/raid/files" # Path de la carpeta compartida del NAS
#-----------------------------------------------------------------------------------------------------------------------------------
# FUNCIONES
#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_info() --> info:dict
# Descripción: Función principal encargada de recabar toda la información y devolverla en forma de diccionario
#-----------------------------------------------------------------------------------------------------------------------------------
def get_info():
    try:
        hostname = socket.gethostname()
    except Exception as e:
        hostname = socket.gethostname()+".local"

    IPAddr = get_ip_address("end0")
    subnet_mask_info = get_subnet_mask("end0")
    gateway_info = str(get_default_gateway())

    RAM_used_GB = round(psutil.virtual_memory()[3]/1000000000, 2) # Memoria RAM usada en GB
    RAM=""+str(RAM_used_GB)+" GB ("+str(psutil.virtual_memory()[2])+"%)"

    cpu_usage=str(psutil.cpu_percent(4))+" %"
    cpu_Temp = get_cpu_temperature()

    disk_stat=get_disk(path=RAID_PATH)

    info = dict(host=hostname,ip=IPAddr,mask=subnet_mask_info,gateway=gateway_info,used_CPU=cpu_usage,Temp_CPU=f"{cpu_Temp}°C",used_RAM=RAM,disk=str(disk_stat))
    
    return info
#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_telematic_info() --> info:dict
# Descripción: Función principal encargada de recabar la información de telematica y devolverla en forma de diccionario
#-----------------------------------------------------------------------------------------------------------------------------------
def get_telematic_info():
    try:
        hostname = socket.gethostname()
    except Exception as e:
        hostname = socket.gethostname()+".local"
    IPAddr = get_ip_address("end0")
    subnet_mask_info = get_subnet_mask("end0")
    gateway_info = str(get_default_gateway())
    dns_info = get_dns_info()

    info = dict(ip=IPAddr,mask=subnet_mask_info,gateway=gateway_info, dns=dns_info)
    
    return info
#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_hardware_info() --> info:dict
# Descripción: Función principal encargada de recabar la información del hardware y devolverla en forma de diccionario
#-----------------------------------------------------------------------------------------------------------------------------------
def get_hardware_info():
    RAM_used_GB = round(psutil.virtual_memory()[3]/1000000000, 2) # Memoria RAM usada en GB
    RAM=""+str(RAM_used_GB)+" GB ("+str(psutil.virtual_memory()[2])+"%)"

    cpu_usage=str(psutil.cpu_percent(4))+" %"
    cpu_Temp = get_cpu_temperature()

    disk_stat=get_disk(path=RAID_PATH)

    info = dict(used_CPU=cpu_usage,Temp_CPU=f"{cpu_Temp}°C",used_RAM=RAM,disk=str(disk_stat))
    
    return info
#-----------------------------------------------------------------------------------------------------------------------------------
def get_ip_address(interface="end0"):
    """Obtiene la dirección IP de la interfaz de red especificada (por defecto 'end0')."""
    try:
        interfaces = psutil.net_if_addrs()
        if interface in interfaces:
            for addr in interfaces[interface]:
                if addr.family == socket.AF_INET:  # IPv4
                    return addr.address
    except Exception as e:
        print(f"Error al obtener la IP de {interface}: {e}")
    return "No disponible"
#-----------------------------------------------------------------------------------------------------------------------------------
def get_subnet_mask(interface="end0"):
    """Obtiene la máscara de subred de la interfaz especificada."""
    try:
        interfaces = psutil.net_if_addrs()
        if interface in interfaces:
            for addr in interfaces[interface]:
                if addr.family == socket.AF_INET:  # IPv4
                    return addr.netmask
    except Exception as e:
        print(f"Error al obtener la máscara de subred de {interface}: {e}")
    return "No disponible"
#-----------------------------------------------------------------------------------------------------------------------------------    
def get_cpu_temperature():
    """Obtiene la temperatura de la CPU en Raspberry Pi 5"""
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            temp_millidegrees = int(f.read().strip())  # Leer temperatura en miligrados
        return temp_millidegrees / 1000.0  # Convertir a grados Celsius
    except Exception as e:
        print(f"Error al obtener la temperatura de la CPU: {e}")
        return None  # Devolver None si falla
#-----------------------------------------------------------------------------------------------------------------------------------
def get_default_gateway():
    """Obtiene la puerta de enlace predeterminada (default gateway)."""
    try:
        gateways = psutil.net_if_stats()
        net_gateways = psutil.net_if_addrs()

        # Buscar en las rutas de red la puerta de enlace
        for gateway in psutil.net_if_stats():
            if gateway == "end0":  # Solo tomamos la de "end0"
                for addr in net_gateways[gateway]:
                    if addr.family == socket.AF_INET:
                        return addr.address  # Devuelve la puerta de enlace

        return None  # Si no se encuentra, devolver None
    except Exception as e:
        print(f"Error al obtener la puerta de enlace predeterminada: {e}")
        return None
#-----------------------------------------------------------------------------------------------------------------------------------
def get_dns_info():
    """Obtiene los servidores DNS del sistema en Linux/Raspberry Pi."""
    try:
        dns_servers = []
        with open("/etc/resolv.conf", "r") as f:
            for line in f:
                if line.startswith("nameserver"):
                    dns_servers.append(line.split()[1])
        return dns_servers if dns_servers else "No DNS found"
    except Exception as e:
        print(f"Error al obtener los servidores DNS: {e}")
        return None

#-----------------------------------------------------------------------------------------------------------------------------------
# path:string --> get_disk() --> stat:tupla
# Descripción: Función encargada de devolver el tamaño del disco (total, usado, libre) en forma de tupla
#-----------------------------------------------------------------------------------------------------------------------------------
def get_disk(path):
    stat = shutil.disk_usage(path) 
    return stat
#-----------------------------------------------------------------------------------------------------------------------------------
# info:dict --> show_info() --> None
# Descripción: Función encargada de mostrar por pantalla el diccionario "info" que contiene toda la información acerca del sistema
#-----------------------------------------------------------------------------------------------------------------------------------
def show_info(info):
    print("\n--------------------------------------------------")
    for key, value in info.items():
        print(f"{key.capitalize()}: {value}")
    print("--------------------------------------------------")
    
    return
#-----------------------------------------------------------------------------------------------------------------------------------
#-----------------------------------------------------------------------------------------------------------------------------------
# MAIN
#-----------------------------------------------------------------------------------------------------------------------------------
def main():

    #info = get_info()
    #show_info(info)
    telematic_info = get_telematic_info()
    show_info(telematic_info)
    hardware_info = get_hardware_info()
    show_info(hardware_info)

    return

if __name__ == "__main__":
    main()