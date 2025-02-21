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
#-----------------------------------------------------------------------------------------------------------------------------------
# FUNCIONES
#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_info() --> info:dict
# Descripción: Función principal encargada de recabar toda la información y devolverla en forma de diccionario
#-----------------------------------------------------------------------------------------------------------------------------------
def get_info():
    hostname = socket.gethostname()
    IPAddr = socket.gethostbyname(hostname)
    subnet_mask_info = get_subnet_mask(hostname)
    gateway_info = str(get_default_gateway())

    RAM_used_GB = round(psutil.virtual_memory()[3]/1000000000, 2) # Memoria RAM usada en GB
    RAM=""+str(RAM_used_GB)+" GB ("+str(psutil.virtual_memory()[2])+"%)"

    cpu_usage=str(psutil.cpu_percent(4))+" %"

    disk_stat=get_disk(path="c:/")

    info = dict(host=hostname,ip=IPAddr,mask=subnet_mask_info,gateway=gateway_info,used_CPU=cpu_usage,used_RAM=RAM,disk=str(disk_stat))
    
    return info
#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_telematic_info() --> info:dict
# Descripción: Función principal encargada de recabar la información de telematica y devolverla en forma de diccionario
#-----------------------------------------------------------------------------------------------------------------------------------
def get_telematic_info():
    hostname = socket.gethostname()
    IPAddr = socket.gethostbyname(hostname)
    subnet_mask_info = get_subnet_mask(hostname)
    gateway_info = str(get_default_gateway())

    info = dict(ip=IPAddr,mask=subnet_mask_info,gateway=gateway_info)
    
    return info
#-----------------------------------------------------------------------------------------------------------------------------------
def get_subnet_mask(hostname_or_ip):
    """Obtiene la máscara de subred (subnet mask) de una dirección IP o hostname."""
    try:
        ip = socket.gethostbyname(hostname_or_ip)  # Resuelve el hostname a una dirección IP
        interfaces = psutil.net_if_addrs()  # Obtiene las interfaces de red
        for iface_addresses in interfaces.values():
            for address in iface_addresses:
                if address.address == ip:
                    return address.netmask
        return None
    except Exception as e:
        print(f"Error al obtener la máscara de subred: {e}")
        return None
#-----------------------------------------------------------------------------------------------------------------------------------
def get_default_gateway():
    """Obtiene la puerta de enlace predeterminada (default gateway)."""
    try:
        gateways = psutil.net_if_stats()
        for iface, addresses in psutil.net_if_addrs().items():
            for addr in addresses:
                if addr.family == socket.AF_INET:
                    return addr.address
        return None
    except Exception as e:
        print(f"Error al obtener la puerta de enlace predeterminada: {e}")
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
    print("")
    print("--------------------------------------------------")
    for i in info:
        print(i.capitalize()+": "+info[i])
    print("--------------------------------------------------")
    
    return
#-----------------------------------------------------------------------------------------------------------------------------------
#-----------------------------------------------------------------------------------------------------------------------------------
# MAIN
#-----------------------------------------------------------------------------------------------------------------------------------
def main():

    info = get_info()
    show_info(info)
    telematic_info = get_telematic_info()
    show_info(telematic_info)

    return

if __name__ == "__main__":
    main()