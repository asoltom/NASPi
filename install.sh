#!/bin/bash

set -e  # Detener en caso de error

# Configuración
USER="naspi"
PROJECT_DIR="/home/$USER/NASPi"
FRONTEND_DIR="$PROJECT_DIR/naspi/frontend"
BACKEND_DIR="$PROJECT_DIR/naspi/backend"
VENV_DIR="$BACKEND_DIR/venv"
FLASK_PORT=5000
OMV_PORT=8080
GIT_REPO="https://github.com/asoltom/NASPi.git"
BRANCH="develop"
NEXT_CONFIG="$FRONTEND_DIR/next.config.js"

# Instalar dependencias
install_dependencies() {
    echo "🔹 Instalando dependencias del sistema..."
    # Actualizar e instalar dependencias base
    sudo apt update && sudo apt full-upgrade -y
    sudo apt install smartmontools -y && sudo apt install hdparm -y

    # Instalamos la versión v20.19.0 del 13/03/2025 de NodeJS
    echo "Añadiendo repositorio de NodeSource para Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

    # Instalar dependencias generales.
    echo "Instalando nodejs (con npm incluido) y otras dependencias..."
    sudo apt install -y python3 python3-venv python3-pip nodejs nginx git docker.io docker-compose

    echo "🔹 Dependencias del sistema instaladas."
}

# Configurar Git y clonar el proyecto
setup_git() {
    echo "🔹 Configurando Git..."
    # Clonar solo si el directorio no existe, como en el script original
    [ ! -d "$PROJECT_DIR" ] && git clone -b $BRANCH $GIT_REPO "$PROJECT_DIR"
}

# Función para configurar Flask
setup_flask() {
    echo "🔹 Configurando Flask (Backend)..."
    python3 -m venv $VENV_DIR
    source $VENV_DIR/bin/activate
    pip install flask flask-cors gunicorn psutil bcrypt
    deactivate
}

# Configurar Next.js build con output: 'export'
setup_next_config() {
    echo "🔹 Configurando Next.js..."
    # Contenido exacto del archivo next.config.js proporcionado originalmente
    cat > "$NEXT_CONFIG" <<EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
};
module.exports = nextConfig;
EOF
}

# Configurar React y compilar
setup_react() {
    echo "🔹 Configurando React..."
    cd "$FRONTEND_DIR"

    # Instalar dependencias listadas en package.json (en tu caso, solo uuid y @types/uuid)
    echo "Instalando dependencias de package.json..."
    npm install

    # Instalar versiones específicas de uuid, next y postcss
    echo "Instalando versiones específicas de uuid, next y postcss (previo a cambios recientes)..."

    npm install uuid@^11.1.0 next@^15.2.0 postcss@^8.4.0

    npm audit fix --force

    setup_next_config

    echo "Ejecutando 'npm run build'..."
    npm run build
}

# Crear servicio de Flask
setup_flask_service() {
    echo "🔹 Creando servicio para Flask..."
    # Contenido exacto del servicio systemd proporcionado originalmente
    sudo tee /etc/systemd/system/flask.service > /dev/null <<EOF
[Unit]
Description=Flask App
After=network.target

[Service]
User=$USER
WorkingDirectory=$BACKEND_DIR
ExecStart=$VENV_DIR/bin/gunicorn -w 8 -t 1200 -b 0.0.0.0:$FLASK_PORT app:app
Restart=always
StandardOutput=append:/var/log/flask.log
StandardError=append:/var/log/flask_error.log

[Install]
WantedBy=multi-user.target
EOF
}

# Configurar Nginx
setup_nginx() {
    echo "🔹 Configurando Nginx..."
    # Contenido exacto del archivo de configuración de Nginx proporcionado originalmente
    sudo tee /etc/nginx/sites-available/proyecto > /dev/null <<EOF
server {
    listen 80;
    server_name naspi.local;

    root $FRONTEND_DIR/out;
    index index.html index.htm;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://naspi.local:$FLASK_PORT/;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        client_max_body_size 20G;  # Permite subir archivos grandes
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
    }

    error_page 404 /index.html;
}
EOF

    # Enlace simbólico y permisos, como en el script original
    sudo ln -sf /etc/nginx/sites-available/proyecto /etc/nginx/sites-enabled/

    sudo chown -R naspi:www-data /mnt/raid
    sudo chmod -R 777 /mnt/raid

    sudo systemctl restart nginx
}

# Configurar rotación de logs
setup_logrotate() {
    echo "🔹 Configurando logrotate..."
    # Contenido exacto del archivo logrotate proporcionado originalmente
    sudo tee /etc/logrotate.d/proyecto > /dev/null <<EOF
/var/log/flask.log
/var/log/flask_error.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
EOF
}

# Habilitar y arrancar servicios
enable_and_start_services() {
    echo "🔹 Iniciando servicios..."
    # Comandos exactos proporcionados originalmente
    sudo systemctl daemon-reload
    sudo systemctl enable --now flask.service
}

# Mensaje final
instructions() {
    echo ""
    echo "✅ Instalación completada. Accede a:"
    echo "🌐 React (Nginx): http://naspi.local"
    echo "📡 Flask API: http://naspi.local/api/"
    echo "🛠️ OMV: http://naspi.local:$OMV_PORT"
}

permisos_extra() {
    # Comandos exactos de permisos extra proporcionados originalmente
    sudo chmod 777 $BACKEND_DIR/data/users.json # Permite lectura y escritura
    echo "Permisos extra en data/users.json"

    sudo chown -R www-data:www-data /home/naspi/NASPi/naspi/frontend/out
    sudo chmod -R 755 /home/naspi/NASPi/naspi/frontend/out

    sudo chmod +x /home/naspi
    sudo chmod +x /home/naspi/NASPi
    sudo chmod +x /home/naspi/NASPi/naspi
    sudo chmod +x /home/naspi/NASPi/naspi/frontend

    sudo chmod g+s /mnt/raid/files/
}

# Ejecutar instalación
main() {
    echo "🚀 Iniciando limpieza de caches y directorios de instalación previos..."

    # Limpiar caché de APT
    echo "🔹 Limpiando caché de APT..."
    sudo apt clean
    sudo apt autoremove -y || true # autoremove puede fallar si no hay nada que remover

    # Limpiar caché de npm (forzado para asegurar una limpieza profunda)
    echo "🔹 Limpiando caché de npm..."
    npm cache clean --force || true # Usamos || true para que el script no falle si hay un error menor en la limpieza

    # Eliminar directorio node_modules en el frontend para forzar una instalación limpia desde cero
    if [ -d "$FRONTEND_DIR/node_modules" ]; then
        echo "🔹 Eliminando directorio node_modules en el frontend..."
        rm -rf "$FRONTEND_DIR/node_modules"
    fi

    echo "✅ Limpieza completada. Procediendo con la instalación..."
    echo "" # Añadir una línea en blanco para mejor legibilidad en la salida

    install_dependencies
    setup_git
    setup_flask
    setup_react
    setup_flask_service
    setup_nginx
    setup_logrotate
    enable_and_start_services
    permisos_extra
    instructions
    echo "✅ Proceso de instalación principal finalizado."
}

main