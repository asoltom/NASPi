#-----------------------------------------------------------------------------------------------------------------------------------
# Autor: Arnau Soler Tomás
# Fichero: NAS_status.py
# Descripción: Fichero en el que se incluyen funciones para recabar información acerca del NAS tales como
# el uso de los discos, su temperatura, si están en buen estado, y la velocidad de datos
#-----------------------------------------------------------------------------------------------------------------------------------
#Librerias
import psutil
import subprocess

# Lista de discos a monitorear (ajusta según tu configuración)
DISKS = ["/mnt/ssd1", "/mnt/ssd2", "/mnt/ssd3"]
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
            temp_output = subprocess.check_output(f"smartctl -A {device} | grep Temperature", shell=True).decode()
            temp_value = int(temp_output.split()[-1])  # Extraer el último valor (temperatura)
            temperatures[device] = f"{temp_value}°C"
        except Exception as e:
            temperatures[device] = f"Error: {e}"
    return temperatures

#-----------------------------------------------------------------------------------------------------------------------------------
# --> get_smart_status() --> smart_status:dict
# Descripción: Verifica el estado SMART de cada disco y devuelve "Healthy" o "Warning".
#-----------------------------------------------------------------------------------------------------------------------------------
def get_smart_status():
    smart_status = {}
    for device in DEVICES:
        try:
            status_output = subprocess.check_output(f"smartctl -H {device}", shell=True).decode()
            if "PASSED" in status_output:
                smart_status[device] = "Healthy"
            else:
                smart_status[device] = "Warning"
        except Exception as e:
            smart_status[device] = f"Error: {e}"
    return smart_status

#-----------------------------------------------------------------------------------------------------------------------------------
# device:str --> get_disk_speed(device:str) --> speed_line
# Descripción: Mide la velocidad de lectura de cada disco usando hdparm.
#-----------------------------------------------------------------------------------------------------------------------------------
def get_disk_speed(device):
    try:
        speed_output = subprocess.check_output(f"hdparm -t {device}", shell=True).decode()
        speed_line = [line for line in speed_output.split("\n") if "MB/sec" in line]
        return speed_line[0] if speed_line else "No data"
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    print("📌 Disk Usage:", get_disk_usage())
    print("🌡️ Temperatures:", get_disk_temperature())
    print("✅ SMART Status:", get_smart_status())
    for dev in DEVICES:
        print(f"⚡ Speed {dev}:", get_disk_speed(dev))
