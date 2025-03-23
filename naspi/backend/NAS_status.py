#-----------------------------------------------------------------------------------------------------------------------------------
# Autor: Arnau Soler Tomás
# Fichero: NAS_status.py
# Descripción: Fichero en el que se incluyen funciones para recabar información acerca del NAS tales como
# el uso de los discos, su temperatura, si están en buen estado, y la velocidad de datos
#-----------------------------------------------------------------------------------------------------------------------------------
#Librerias
import psutil
import re
import subprocess

# Lista de discos a monitorear (ajusta según tu configuración)
DISKS = ["/mnt/raid/files"]
DEVICES = ["/dev/sda", "/dev/sdb", "/dev/sdc"]
#-----------------------------------------------------------------------------------------------------------------------------------
# FUNCIONES
#-----------------------------------------------------------------------------------------------------------------------------------
#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_disk_usage() --> usage:dict
# Descripción: Obtiene el uso de cada disco (total, usado, libre y porcentaje de uso).
#-----------------------------------------------------------------------------------------------------------------------------------
def get_disk_usage():
    usage = {}
    for disk in DISKS:
        try:
            stat = psutil.disk_usage(disk)
            usage[disk] = {"Total": stat.total, "Used": stat.used, "Free": stat.free, "Percent": stat.percent}
        except Exception as e:
            usage[disk] = f"Error: {e}"
    return usage

#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_disk_temperature() --> temperatures:dict
# Descripción: Obtiene la temperatura de cada disco SSD usando smartctl.
#-----------------------------------------------------------------------------------------------------------------------------------
def get_disk_temperature():
    temperatures = {}
    for device in DEVICES:
        try:
            # Ejecutar smartctl con -d sat por si es USB
            temp_output = subprocess.check_output(f"smartctl -A -d sat {device}", shell=True).decode()

            # Buscar la línea de temperatura usando regex
            match = re.search(r"Temperature.*?(\d+)\s*C", temp_output)
            
            if match:
                temp_value = int(match.group(1))  # Extraer el número correcto
                temperatures[device] = f"{temp_value}°C"
            else:
                temperatures[device] = "No se encontró temperatura en SMART"
                
        except Exception as e:
            temperatures[device] = f"Error: {e} (Posible falta de soporte SMART en USB)"

    return temperatures

#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_smart_status() --> smart_status:dict
# Descripción: Verifica el estado SMART de cada disco y devuelve "Healthy" o "Warning".
#-----------------------------------------------------------------------------------------------------------------------------------
def detect_device_type(device):
    """Intenta detectar el tipo de dispositivo correcto para smartctl."""
    try:
        output = subprocess.check_output(["sudo", "smartctl", "-i", device], text=True, stderr=subprocess.STDOUT)
        if "SATA" in output or "ATA" in output:
            return "sat"
        elif "SCSI" in output or "NVMe" in output:
            return "scsi"
        else:
            return "auto"  # Usa auto si no se detecta claramente
    except subprocess.CalledProcessError:
        return "auto"

def get_smart_status():
    smart_status = {}

    for device in DEVICES:
        device_type = detect_device_type(device)  # Detecta tipo de dispositivo
        try:
            status_output = subprocess.check_output(
                ["sudo", "smartctl", "-H", "-d", device_type, device],
                text=True, stderr=subprocess.STDOUT
            )
            if "SMART Health Status: OK" in status_output:
                smart_status[device] = "Healthy"
            else:
                smart_status[device] = "Warning"
        except subprocess.CalledProcessError as e:
            smart_status[device] = f"Error: {e.output.strip()}"
        except Exception as e:
            smart_status[device] = f"Unexpected Error: {str(e)}"

    return smart_status

#-----------------------------------------------------------------------------------------------------------------------------------
# device:str --> get_disk_speed(device:str) --> speed_line
# Descripción: Mide la velocidad de lectura de cada disco usando hdparm.
#-----------------------------------------------------------------------------------------------------------------------------------
def get_disk_speed(device):
    try:
        speed_output = subprocess.check_output(f"sudo hdparm -t {device}", shell=True).decode()
        speed_line = [line for line in speed_output.split("\n") if "MB/sec" in line]

        if speed_line:
            # Buscar solo el valor numérico antes de "MB/sec"
            match = re.search(r"([\d.]+)\sMB/sec", speed_line[0])
            if match:
                return f"{match.group(1)} MB/sec"
        
        return "No data"
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    print("📌 Disk Usage:", get_disk_usage())
    print("🌡️ Temperatures:", get_disk_temperature())
    print("✅ SMART Status:", get_smart_status())
    for dev in DEVICES:
        print(f"⚡ Speed {dev}:", get_disk_speed(dev))
