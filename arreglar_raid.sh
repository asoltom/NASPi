#!/bin/bash

# Dispositivo RAID a reparar
RAID_DEVICE="/dev/md0"
# Punto de montaje final (necesario para desmontar antes de manipular)
MOUNT_POINT="/mnt/raid/files"

# Nombre del dispositivo del NUEVO disco de reemplazo
# DEBES EJECUTAR ESTE SCRIPT ASÍ: sudo ./arreglar_raid.sh /dev/sdX
# donde /dev/sdX es el nuevo disco que has conectado.
NEW_DISK="$1"

# --- Validaciones iniciales ---

if [ -z "$NEW_DISK" ]; then
    echo "❌ ERROR: Debes especificar el dispositivo del disco nuevo a añadir."
    echo "Uso: sudo ./arreglar_raid.sh /dev/sdX (ej: sudo ./arreglar_raid.sh /dev/sde)"
    exit 1
fi

if [ ! -b "$NEW_DISK" ]; then
    echo "❌ ERROR: El dispositivo $NEW_DISK no existe. Verifica con lsblk."
    exit 1
fi

# Verificar si el dispositivo RAID existe y está reconocido por mdadm
if ! sudo mdadm --detail "$RAID_DEVICE" > /dev/null 2>&1; then
    echo "❌ ERROR: El dispositivo RAID $RAID_DEVICE no existe o no está configurado."
    echo "Este script es para reparar un array existente."
    exit 1
fi

echo "🚀 Iniciando proceso para añadir el nuevo disco $NEW_DISK al array $RAID_DEVICE..."

# --- Detener servicios y desmontar ---

# Detener servicios que puedan estar usando el punto de montaje del RAID
echo "✋ Deteniendo servicios que puedan usar $MOUNT_POINT (nginx, docker)..."
# Usamos 2>/dev/null para suprimir errores si los servicios no existen o no están corriendo
sudo systemctl stop nginx docker 2>/dev/null
sudo systemctl daemon-reload
sleep 2 # Dar tiempo a los servicios para detenerse

# Desmontar el sistema de archivos del RAID
echo "Desmontando el sistema de archivos en $MOUNT_POINT..."
# mountpoint -q verifica silenciosamente si un directorio es un punto de montaje
if mountpoint -q "$MOUNT_POINT"; then
    # Intenta desmontaje normal primero
    sudo umount "$MOUNT_POINT"
    if [ $? -ne 0 ]; then
        echo "⚠️ Advertencia: No se pudo desmontar $MOUNT_POINT limpiamente. Intentando desmontaje 'lazy'."
        # Desmontaje "lazy" si algo todavía lo está usando
        sudo umount -l "$MOUNT_POINT"
        sleep 2
        # Verificar de nuevo si todavía está montado
        if mountpoint -q "$MOUNT_POINT"; then
             echo "❌ ERROR: No se pudo desmontar $MOUNT_POINT. Está ocupado. Usa 'lsof $MOUNT_POINT' o 'fuser -m $MOUNT_POINT' para identificar el proceso."
             # Intenta reiniciar servicios antes de salir si falla el desmontaje
             echo "▶️ Intentando reiniciar servicios antes de salir..."
             sudo systemctl start nginx docker 2>/dev/null
             exit 1
         fi
    fi
    echo "✅ $MOUNT_POINT desmontado con éxito."
else
    echo "⚠️ $MOUNT_POINT no estaba montado. Continuando."
fi

# --- Preparar el nuevo disco ---

echo "⚠️ Limpiando el nuevo disco $NEW_DISK para asegurar que no tiene datos o firmas previas..."
# wipefs es crucial para eliminar superbloques de RAID o sistemas de archivos antiguos
sudo wipefs -a -f "$NEW_DISK" || { echo "❌ ERROR en wipefs $NEW_DISK"; exit 1; }
# Opcional: Sobreescribir el inicio del disco para mayor seguridad (limpiar tablas de partición, etc.)
echo "✍️ Sobrescribiendo inicio del nuevo disco $NEW_DISK..."
sudo dd if=/dev/zero of="$NEW_DISK" bs=1M count=100 status=progress || { echo "❌ ERROR en dd $NEW_DISK"; exit 1; }
sudo partprobe "$NEW_DISK" 2>/dev/null # Informa al kernel de cambios en la tabla de particiones (eliminada)
sleep 3 # Da tiempo al kernel

# --- Añadir el nuevo disco y reconstruir ---

echo "🔍 Estado actual del array $RAID_DEVICE antes de añadir el disco:"
sudo mdadm --detail "$RAID_DEVICE" || echo "⚠️ No se pudo obtener detalles del RAID. Continuando..."

echo "➕ Añadiendo el nuevo disco $NEW_DISK al array $RAID_DEVICE..."
# mdadm --manage --add añadirá el disco y comenzará la reconstrucción automáticamente si el array está degradado
sudo mdadm --manage "$RAID_DEVICE" --add "$NEW_DISK"
ADD_STATUS=$?

if [ $ADD_STATUS -ne 0 ]; then
    echo "❌ ERROR: Falló al añadir el disco $NEW_DISK al RAID $RAID_DEVICE."
    echo "Revisa la salida de mdadm y el estado del array con 'sudo mdadm --detail $RAID_DEVICE'."
    # Intenta remontar y reiniciar servicios antes de salir si falla la adición del disco
    echo "⤴️ Intentando remontar y reiniciar servicios antes de salir..."
    sudo mount "$RAID_DEVICE" "$MOUNT_POINT" 2>/dev/null
    sudo systemctl start nginx docker 2>/dev/null
    exit 1
fi

echo "✅ Disco $NEW_DISK añadido al RAID $RAID_DEVICE. La reconstrucción (resync) debería haber comenzado."

# Esperar a que la reconstrucción termine
echo "⏳ Esperando a que la reconstrucción del RAID termine. Esto puede tardar varias horas, dependiendo del tamaño de los discos."
# Espera mientras el estado del array contenga "resync" o "recovery"
while cat /proc/mdstat 2>/dev/null | grep -q "$RAID_DEVICE" && cat /proc/mdstat 2>/dev/null | grep -q "resync\|recovery"; do
   echo "Reconstruyendo: $(cat /proc/mdstat 2>/dev/null | grep "^$RAID_DEVICE :")"
   sleep 30 # Espera 30 segundos entre comprobaciones
done

# --- Verificación final ---

echo "🔍 Verificando estado final del array $RAID_DEVICE después de la reconstrucción:"
sudo mdadm --detail "$RAID_DEVICE" || echo "⚠️ No se pudo obtener detalles finales del RAID."

# Verificar si el array está en estado limpio y con todos los discos activos ([UUU] para 3 discos)
if ! cat /proc/mdstat 2>/dev/null | grep -q "^$RAID_DEVICE :.*\[UUU\]"; then
    echo "❌ ERROR: El array $RAID_DEVICE no alcanzó el estado [UUU] después de la reconstrucción."
    echo "Inspecciona 'sudo mdadm --detail $RAID_DEVICE' y '/proc/mdstat' para diagnosticar."
    # No salimos con éxito si el estado final no es limpio
    # Intentamos remontar y reiniciar servicios de todas formas
    echo "⤴️ Intentando remontar y reiniciar servicios a pesar del estado final..."
    sudo mount "$RAID_DEVICE" "$MOUNT_POINT" 2>/dev/null
    sudo systemctl start nginx docker 2>/dev/null
    exit 1 # Salir con código de error
fi

echo "✅ Reconstrucción del array $RAID_DEVICE completada con éxito. Estado [UUU]."

# --- Remontar y reiniciar servicios ---

echo "⤴️ Remontando el sistema de archivos en $MOUNT_POINT..."
sudo mount "$RAID_DEVICE" "$MOUNT_POINT"
 if [ $? -ne 0 ]; then
    echo "❌ ERROR: Falló el montaje de $RAID_DEVICE en $MOUNT_POINT después de la reparación."
    # Intenta reiniciar servicios antes de salir si falla el montaje
    echo "▶️ Intentando reiniciar servicios antes de salir..."
    sudo systemctl start nginx docker 2>/dev/null
    exit 1
fi
echo "✅ RAID remontado con éxito."

# Reiniciar servicios que se detuvieron
echo "▶️ Reiniciando servicios (nginx, docker)..."
# Usamos 'start' por si acaso no estaban corriendo inicialmente
sudo systemctl start nginx docker 2>/dev/null
echo "✅ Servicios iniciados."

echo "🎉 Proceso de reparación del RAID $RAID_DEVICE completado (disco $NEW_DISK añadido y reconstrucción finalizada)."
echo "Verifica el estado final con 'sudo mdadm --detail $RAID_DEVICE' y 'cat /proc/mdstat'."

exit 0 # Salir con éxito si todo el proceso de reparación (añadir disco) ha sido exitoso