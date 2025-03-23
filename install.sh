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
    sudo apt update && sudo apt full-upgrade -y && sudo apt install smartmontools -y && sudo apt install hdparm -y
    sudo apt install -y python3 python3-venv python3-pip nodejs npm nginx git docker.io docker-compose
}

# Configurar Git y clonar el proyecto
setup_git() {
    echo "🔹 Configurando Git..."
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

# Configurar Next.js
setup_next_config() {
    echo "🔹 Configurando Next.js..."
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
    npm install
    npm install uuid next@latest postcss@latest
    npm audit fix --force
    setup_next_config
    npm run build
}

# Crear servicio de Flask
setup_flask_service() {
    echo "🔹 Creando servicio para Flask..."
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

    sudo ln -sf /etc/nginx/sites-available/proyecto /etc/nginx/sites-enabled/

    sudo chown -R naspi:www-data /mnt/raid
    sudo chmod -R 777 /mnt/raid

    sudo systemctl restart nginx
}

# Configurar rotación de logs
setup_logrotate() {
    echo "🔹 Configurando logrotate..."
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
    sudo chmod 777 $BACKEND_DIR/data/users.json  # Permite lectura y escritura
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
}

main
