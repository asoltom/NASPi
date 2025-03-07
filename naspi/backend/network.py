#-----------------------------------------------------------------------------------------------------------------------------------
# Autor: Arnau Soler Tomás
# Fichero: network.py
# Descripción: Fichero en el que se incluyen funciones para recabar información acerca del sistema (Host, IP, CPU, RAM, Disk)
#-----------------------------------------------------------------------------------------------------------------------------------
#Librerias
import subprocess
import os
import socket

# Variables Globales
hostname = socket.gethostname()
IPAddr = socket.gethostbyname(hostname)

RPiIp = ""+IPAddr
#-----------------------------------------------------------------------------------------------------------------------------------
# FUNCIONES
#-----------------------------------------------------------------------------------------------------------------------------------
#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_network_speed() --> speedtest_output:str
# Descripción: Obtiene la velocidad de Internet (descarga y subida) usando speedtest-cli.
#-----------------------------------------------------------------------------------------------------------------------------------
def get_network_speed():
    try:
        speedtest_output = subprocess.check_output("speedtest-cli --simple", shell=True).decode()
        return speedtest_output
    except Exception as e:
        return f"Error: {e}"

#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_latency(target:str) --> info:str
# Descripción: Hace un ping a la IP especificada y devuelve la latencia promedio.
#-----------------------------------------------------------------------------------------------------------------------------------
def get_latency(target=RPiIp):
    try:
        ping_output = subprocess.check_output(f"ping -c 4 {target}", shell=True).decode()
        latency_line = [line for line in ping_output.split("\n") if "avg" in line]
        return latency_line[0] if latency_line else "No data"
    except Exception as e:
        return f"Error: {e}"

#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_ethernet_speed() --> info:str
# Descripción: Obtiene la velocidad del puerto Ethernet usando ethtool.
#-----------------------------------------------------------------------------------------------------------------------------------
def get_ethernet_speed():
    try:
        eth_output = subprocess.check_output("ethtool eth0 | grep Speed", shell=True).decode()
        return eth_output.strip()
    except Exception as e:
        return f"Error: {e}"

#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_connected_devices() --> info:str
# Descripción: Muestra los dispositivos conectados a la red mediante ARP.
#-----------------------------------------------------------------------------------------------------------------------------------
def get_connected_devices():
    try:
        arp_output = subprocess.check_output("arp -a", shell=True).decode()
        return arp_output
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    print("📶 Network Speed:", get_network_speed())
    print("📡 Latency:", get_latency())
    print("🔌 Ethernet Speed:", get_ethernet_speed())
    print("🔍 Connected Devices:\n", get_connected_devices())
