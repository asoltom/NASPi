#!/bin/bash

# Deteniendo Nginx y Docker
echo "Deteniendo Nginx y Docker..."
sudo systemctl stop nginx
sudo systemctl stop docker
sudo systemctl daemon-reload
echo ""

# Visualizar mnt/raid
echo "Visualizando contenido raid..."
mount | grep raid
ls -la /mnt/raid
ls -la /mnt/raid/files

# Desmontar
echo "Desmontando raid y raid/files"
sudo umount -l /mnt/raid/files
sudo umount -l /mnt/raid

# Reparar
echo "Reparando /dev/md0"
sudo fsck -y /dev/md0

# Reiniciar
echo "Reiniciando..."
sudo systemctl daemon-reload
echo "Ejecutando crear_raid5.sh"
sudo ./crear_raid5.sh