#!/bin/bash

# Discos a usar en el RAID
DISK1="/dev/sda"
DISK2="/dev/sdb"
DISK3="/dev/sdc"
RAID_DEVICE_REQ="/dev/md0" # Nombre de dispositivo solicitado
MOUNT_POINT="/mnt/raid/files" # Punto de montaje final

echo "🚀 Iniciando la configuración del RAID 5 con mdadm..."

# Verificar si los discos existen
echo "🔍 Verificando discos..."
for disk in $DISK1 $DISK2 $DISK3; do
    if [ ! -b "$disk" ]; then
        echo "❌ ERROR: El disco $disk no existe. Verifica con lsblk."
        exit 1
    fi
    # Opcional: Verificar si el disco está montado o en uso ANTES de intentar limpiarlo
    # Usamos 'grep -w' para coincidencia exacta de la palabra para evitar coincidencia parcial (ej: /dev/sda1 con /dev/sda)
    if mount | grep -wq "$disk"; then
        echo "⚠️ Advertencia: El disco $disk parece estar montado. Intentando desmontar..."
        # Intenta desmontar todas las particiones del disco si existen, y el disco base
        sudo umount "$disk"* 2>/dev/null # Desmontar particiones
        sudo umount "$disk" 2>/dev/null # Desmontar disco base
        sleep 2 # Da tiempo al sistema
        if mount | grep -wq "$disk"; then
            echo "❌ ERROR: No se pudo desmontar $disk. Está ocupado. Usa lsof/fuser para identificar el proceso."
            exit 1
        fi
    fi
    if swapon --show | grep -wq "$disk"; then
        echo "⚠️ Advertencia: El disco $disk se usa para swap. Desactivando swap..."
        # Intenta desactivar swap en las particiones si existen, y el disco base
        sudo swapoff "$disk"* 2>/dev/null # Swap en particiones
        sudo swapoff "$disk" 2>/dev/null # Swap en disco base
        sleep 2
        if swapon --show | grep -wq "$disk"; then
            echo "❌ ERROR: No se pudo desactivar swap en $disk. Está ocupado."
            exit 1
        fi
    fi
done

# Verificar si el RAID solicitado ($RAID_DEVICE_REQ=/dev/md0) ya existe y está activo
# Esto evita borrar un RAID ya configurado si no es lo que queremos
if sudo mdadm --detail "$RAID_DEVICE_REQ" > /dev/null 2>&1; then
    echo "⚠️ El dispositivo RAID $RAID_DEVICE_REQ ya parece existir o estar configurado."
    # Opcional: Aquí podrías añadir lógica para confirmar si quieres borrarlo o salir
    echo "Si deseas recrearlo, debes detenerlo y borrarlo manualmente o modificar el script."
    exit 0 # Salir si md0 ya existe
fi

# Limpiar los discos (¡Esto borra TODO en los discos seleccionados!)
echo "⚠️ Borrando firmas y datos previos en los discos $DISK1 $DISK2 $DISK3..."
# Usar -f para forzar en caso de que todavía haya alguna referencia débil
sudo wipefs -a -f $DISK1 $DISK2 $DISK3
echo "✍️ Sobrescribiendo inicio de discos para mayor limpieza (puede tardar)..."
# bs=1M count=100 es suficiente para borrar los metadatos de mdadm y tablas de partición
sudo dd if=/dev/zero of=$DISK1 bs=1M count=100 status=progress || { echo "❌ ERROR en dd $DISK1"; exit 1; }
sudo dd if=/dev/zero of=$DISK2 bs=1M count=100 status=progress || { echo "❌ ERROR en dd $DISK2"; exit 1; }
sudo dd if=/dev/zero of=$DISK3 bs=1M count=100 status=progress || { echo "❌ ERROR en dd $DISK3"; exit 1; }
sudo partprobe # Informa al kernel sobre los cambios (eliminación de particiones)
sleep 5 # Dar tiempo al kernel

# Crear RAID 5 con mdadm
echo "🛠️ Creando RAID 5 con mdadm (solicitando $RAID_DEVICE_REQ)..."
# Redirige stderr a stdout para capturar mensajes de error/verbose
# Capturamos la salida para encontrar el nombre de dispositivo real asignado
MDADM_CREATE_OUTPUT=$(sudo mdadm --create --verbose $RAID_DEVICE_REQ --level=5 --raid-devices=3 $DISK1 $DISK2 $DISK3 2>&1)
CREATE_STATUS=$?

echo "$MDADM_CREATE_OUTPUT" # Mostrar la salida verbose

if [ $CREATE_STATUS -ne 0 ]; then
    echo "❌ ERROR: Falló la creación inicial del RAID con mdadm."
    exit 1
fi

# Intentar extraer el nombre de dispositivo real que mdadm asignó (ej: /dev/md127)
# Buscamos líneas como "mdadm: array /dev/md127 started..." en la salida verbose
ACTUAL_RAID_DEVICE=$(echo "$MDADM_CREATE_OUTPUT" | grep "mdadm: array /dev/md" | awk '{print $3}' | sed 's/started.*//')

if [ -z "$ACTUAL_RAID_DEVICE" ]; then
    echo "❌ ERROR: No se pudo determinar el nombre del dispositivo RAID creado. Revisa la salida de mdadm."
    exit 1
fi

echo "✅ RAID creado inicialmente como $ACTUAL_RAID_DEVICE."

# Esperar a que el array inicial ($ACTUAL_RAID_DEVICE) termine de sincronizar
echo "⏳ Esperando a que el RAID termine de sincronizar ($ACTUAL_RAID_DEVICE)..."
# Espera mientras esté resyncing o recovering
while cat /proc/mdstat 2>/dev/null | grep -q "$ACTUAL_RAID_DEVICE" && cat /proc/mdstat 2>/dev/null | grep -q "resync\|recovering"; do
    echo "Sincronizando: $(cat /proc/mdstat 2>/dev/null | grep "^$ACTUAL_RAID_DEVICE :")"
    sleep 10
done

# Verificar si el dispositivo RAID existe y está activo (estado [UUU] para 3 discos)
if ! cat /proc/mdstat 2>/dev/null | grep -q "^$ACTUAL_RAID_DEVICE :.*\[UUU\]"; then
    echo "❌ ERROR: El dispositivo RAID $ACTUAL_RAID_DEVICE no alcanzó el estado [UUU] después de la creación/sincronización."
    cat /proc/mdstat 2>/dev/null # Mostrar estado actual
    exit 1
fi

echo "✅ RAID $ACTUAL_RAID_DEVICE sincronizado y disponible."

# --- Pasos clave para asegurar que el array se ensamble como /dev/md0 ---

echo "✋ Deteniendo el array $ACTUAL_RAID_DEVICE para poder reensamblarlo como $RAID_DEVICE_REQ..."
sudo mdadm --stop $ACTUAL_RAID_DEVICE
sleep 3 # Dar tiempo al kernel para liberar el dispositivo

# Verificar si se detuvo correctamente
if sudo mdadm --detail $ACTUAL_RAID_DEVICE > /dev/null 2>&1; then
    echo "❌ ERROR: No se pudo detener el array $ACTUAL_RAID_DEVICE."
    exit 1
fi
echo "✅ Array $ACTUAL_RAID_DEVICE detenido."

# Guardar la configuración actual de mdadm. Esto crea la línea ARRAY con el UUID y el nombre solicitado.
echo "📄 Guardando configuración de mdadm en /etc/mdadm/mdadm.conf..."
# Este comando escanea todos los arrays (incluso los detenidos con superbloque válido)
# y escribe su configuración, incluyendo UUID y el nombre solicitado si se usó --create con nombre.
sudo mdadm --detail --scan | sudo tee /etc/mdadm/mdadm.conf
# Opcional: Verificar/editar mdadm.conf si necesitas forzar la línea de tu array al principio
# o asegurar que tenga 'name=hostname:0'. Para este caso, --detail --scan suele ser suficiente
# si pediste /dev/md0 al crear.
echo "✅ Configuración de mdadm guardada."

# Ensamblar el RAID usando el archivo de configuración. Esto debería usar /dev/md0 si está libre.
echo "🔧 Ensamblando el array usando la configuración de mdadm.conf (buscando $RAID_DEVICE_REQ)..."
# Usamos --run para activarlo inmediatamente si el ensamblaje es exitoso
sudo mdadm --assemble --scan --run
ASSEMBLE_STATUS=$?
sleep 5 # Dar tiempo al sistema para crear el nodo de dispositivo /dev/md0

if [ $ASSEMBLE_STATUS -ne 0 ]; then
    echo "❌ ERROR: Falló el ensamblaje del array con mdadm --assemble --scan."
    # Revisa los logs del sistema (journalctl -xe) si esto falla para ver la causa.
    exit 1
fi

# Verificación final: Asegurarse de que /dev/md0 ahora existe y está activo
if [ ! -b "$RAID_DEVICE_REQ" ] || ! cat /proc/mdstat 2>/dev/null | grep -q "^$RAID_DEVICE_REQ :.*\[UUU\]"; then
    echo "❌ ERROR: El dispositivo RAID $RAID_DEVICE_REQ no está disponible o no está activo ([UUU]) después del ensamblaje."
    cat /proc/mdstat 2>/dev/null # Mostrar estado actual
    exit 1
fi

echo "✅ RAID ensamblado y disponible como $RAID_DEVICE_REQ."

# --- Continuar con Formateo y Montaje usando el nombre de dispositivo deseado (/dev/md0) ---

# Formatear el RAID en ext4
echo "📀 Formateando RAID en ext4 ($RAID_DEVICE_REQ)..."
sudo mkfs.ext4 $RAID_DEVICE_REQ
# **VERIFICAR EL ESTADO DE SALIDA DEL COMANDO ANTERIOR**
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Falló el formateo del RAID en ext4."
    exit 1
fi
echo "✅ RAID formateado con éxito."

# Crear el punto de montaje y montar el RAID
echo "📁 Creando directorio y montando el RAID ($RAID_DEVICE_REQ en $MOUNT_POINT)..."
sudo mkdir -p $MOUNT_POINT
# Montar el RAID device directamente al punto de montaje final
sudo mount $RAID_DEVICE_REQ $MOUNT_POINT
# **VERIFICAR EL ESTADO DE SALIDA DEL COMANDO ANTERIOR**
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Falló el montaje de $RAID_DEVICE_REQ en $MOUNT_POINT."
    exit 1
fi
echo "✅ RAID montado con éxito en $MOUNT_POINT"

# Configurar montaje automático en /etc/fstab
echo "📌 Configurando montaje automático en /etc/fstab para $RAID_DEVICE_REQ..."
# Primero, elimina cualquier entrada existente para el RAID device o el punto de montaje
sudo sed -i "\#^${RAID_DEVICE_REQ}\s#d" /etc/fstab
sudo sed -i "\#^${MOUNT_POINT}\s#d" /etc/fstab
# Ahora añade la nueva entrada limpia usando $RAID_DEVICE_REQ
echo "$RAID_DEVICE_REQ $MOUNT_POINT ext4 defaults,nofail 0 0" | sudo tee -a /etc/fstab
echo "✅ Configuración de fstab actualizada."

# Ya guardamos mdadm.conf, esta línea es redundante aquí
# echo "📄 Guardando configuración de mdadm..."
# sudo mdadm --detail --scan | sudo tee /etc/mdadm/mdadm.conf
# echo "✅ Configuración de mdadm guardada."

echo "🎉 RAID 5 configurado y montado con éxito en $MOUNT_POINT usando $RAID_DEVICE_REQ"
echo "🔗 Deberías poder verlo ahora en OMV. Es posible que necesites reiniciar OMV o el sistema para que detecte el RAID y el montaje correctamente."

exit 0