#!/bin/bash

# Discos a usar en el RAID
DISK1="/dev/sda"
DISK2="/dev/sdb"
DISK3="/dev/sdc"
RAID_DEVICE="/dev/md0"
MOUNT_POINT="/mnt/raid/files"

echo "🚀 Iniciando la configuración del RAID 5 con mdadm..."

# 1️⃣ Verificar si los discos existen
echo "🔍 Verificando discos..."
for disk in $DISK1 $DISK2 $DISK3; do
    if [ ! -b "$disk" ]; then
        echo "❌ ERROR: El disco $disk no existe. Verifica con lsblk."
        exit 1
    fi
done

# 2️⃣ Limpiar los discos (¡Esto borra TODO en los discos seleccionados!)
echo "⚠️ Borrando firmas y datos previos en los discos..."
sudo wipefs -a $DISK1 $DISK2 $DISK3
sudo dd if=/dev/zero of=$DISK1 bs=1M count=100
sudo dd if=/dev/zero of=$DISK2 bs=1M count=100
sudo dd if=/dev/zero of=$DISK3 bs=1M count=100

# 3️⃣ Crear RAID 5 con mdadm
echo "🛠️ Creando RAID 5 con mdadm..."
sudo mdadm --create --verbose $RAID_DEVICE --level=5 --raid-devices=3 $DISK1 $DISK2 $DISK3

# 4️⃣ Esperar a que el RAID se inicialice
echo "⏳ Esperando a que el RAID se configure..."
sleep 5
cat /proc/mdstat

# 5️⃣ Formatear el RAID en ext4
echo "📀 Formateando RAID en ext4..."
sudo mkfs.ext4 $RAID_DEVICE

# 6️⃣ Crear el punto de montaje y montar el RAID
echo "📁 Creando directorio y montando el RAID..."
sudo mkdir -p $MOUNT_POINT
sudo mount $RAID_DEVICE $MOUNT_POINT
sudo mount /mnt/raid

# 7️⃣ Agregar a /etc/fstab para montaje automático
echo "📌 Configurando montaje automático en /etc/fstab..."
echo "$RAID_DEVICE /mnt/raid ext4 defaults,nofail 0 0" | sudo tee -a /etc/fstab
echo "/mnt/raid $MOUNT_POINT none bind 0 0" | sudo tee -a /etc/fstab

# 8️⃣ Guardar configuración de mdadm
echo "📄 Guardando configuración de mdadm..."
sudo mdadm --detail --scan | sudo tee -a /etc/mdadm/mdadm.conf
sudo update-initramfs -u

echo "✅ RAID 5 configurado con éxito en $MOUNT_POINT"
echo "🔗 Ahora puedes administrarlo en OMV"

exit 0
