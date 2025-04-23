#!/bin/bash

set -e  # Detener en caso de error

# Configuración
USER="naspi" # Asegúrate de que este usuario existe en el sistema
PROJECT_DIR="/home/$USER/NASPi"
FRONTEND_DIR="$PROJECT_DIR/naspi/frontend"
BACKEND_DIR="$PROJECT_DIR/naspi/backend"
VENV_DIR="$BACKEND_DIR/venv"
FLASK_PORT=5000
OMV_PORT=8080 # Este puerto parece ser para OpenMediaVault, no relacionado directamente con esto, pero lo mantengo
GIT_REPO="https://github.com/asoltom/NASPi.git" # Asegúrate de que este repo contenga tus archivos app.py y portainer_manager.py actualizados
BRANCH="develop"
NEXT_CONFIG="$FRONTEND_DIR/next.config.js"
PORTAINER_CONTAINER_NAME="portainer"
PORTAINER_DATA_VOLUME="portainer_data"
PORTAINER_PORT_HTTP=9000 # Puerto HTTP (tradicional, aunque 9443 HTTPS es preferido)
PORTAINER_PORT_HTTPS=9443 # Puerto HTTPS (recomendado)

# Instalar dependencias
install_dependencies() {
    echo "🔹 Instalando dependencias del sistema..."
    # Actualizar e instalar dependencias base
    sudo apt update && sudo apt full-upgrade -y

    # Instalar dependencias generales.
    echo "Instalando python3, venv, pip, nodejs (con npm), nginx, git, docker y docker-compose..."
    # Añadimos smartmontools y hdparm que ya estaban
    sudo apt install -y python3 python3-venv python3-pip nodejs nginx git docker.io docker-compose smartmontools hdparm

    # Añadimos el usuario al grupo docker para poder ejecutar comandos docker sin sudo
    # Cierra la sesión SSH y vuelve a conectarte para que el cambio surta efecto
    sudo usermod -aG docker $USER
    echo "Usuario '$USER' añadido al grupo 'docker'. Por favor, cierra la sesión y vuelve a conectarte."

    echo "🔹 Dependencias del sistema instaladas."
}

# Configurar Git y clonar el proyecto
setup_git() {
    echo "🔹 Configurando Git..."
    # Clonar solo si el directorio no existe. Si ya existe, asumimos que ya contiene el código.
    if [ ! -d "$PROJECT_DIR" ]; then
        echo "Clonando repositorio..."
        git clone -b $BRANCH $GIT_REPO "$PROJECT_DIR"
    else
        echo "Directorio del proyecto ya existe. Saltando clonación."
        # Opcional: añadir aquí un 'git pull' si quieres actualizar el código existente
        # echo "Actualizando código del repositorio..."
        # cd "$PROJECT_DIR" && git pull origin $BRANCH && cd -
    fi
}

# Función para configurar Flask
setup_flask() {
    echo "🔹 Configurando Flask (Backend)..."
    # Asegurarse de que el directorio del backend existe antes de crear el venv
    mkdir -p "$BACKEND_DIR"
    cd "$BACKEND_DIR"

    echo "Creando entorno virtual Python..."
    python3 -m venv $VENV_DIR

    echo "Activando entorno virtual e instalando dependencias Python..."
    source $VENV_DIR/bin/activate
    # !!! MODIFICACION: Añadimos requests y python-dotenv !!!
    pip install flask flask-cors gunicorn psutil bcrypt requests python-dotenv
    deactivate

    echo "🔹 Configuración de Flask completada."
}

# Configurar Next.js build con output: 'export'
setup_next_config() {
    echo "🔹 Configurando Next.js build con output: 'export'..."
    # Asegurarse de que el directorio del frontend existe
    mkdir -p "$FRONTEND_DIR"
    # Contenido exacto del archivo next.config.js proporcionado originalmente
    cat > "$NEXT_CONFIG" <<EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
};
module.exports = nextConfig;
EOF
    echo "Archivo next.config.js creado/actualizado."
}

# Configurar React y compilar
setup_react() {
    echo "🔹 Configurando React (Frontend)..."
    # Asegurarse de que el directorio del frontend existe
    mkdir -p "$FRONTEND_DIR"
    cd "$FRONTEND_DIR"

    echo "Instalando dependencias de package.json..."
    # Usamos --legacy-peer-deps por si hay conflictos con dependencias de Next/React
    npm install --legacy-peer-deps

    echo "Instalando versiones específicas de uuid, next y postcss..."
    # Asegurarse de instalar Next 15.x para que output: 'export' funcione bien con versiones recientes
    # uuid@^11.1.0 no es compatible con Node.js 20.x, la versión 9.x o 10.x sí lo es.
    # Si necesitas uuid, usa una versión compatible o asegúrate de que tus librerías lo soporten.
    # Para el ejemplo, instalaremos uuid@^9.0.0 que sí funciona.
    # Considera si realmente necesitas forzar versiones tan antiguas de Next/PostCSS.
    # Las versiones más recientes de Next (sin export) son mejores para features, pero requieren Node.js server.
    # Si *necesitas* export estático, Next 13/14 es más común para eso. Ajusta según tu proyecto exacto.
    npm install uuid@^9.0.0 next@^15.2.0 postcss@^8.4.0 --legacy-peer-deps


    echo "Corrigiendo auditoría npm..."
    # Usa --force con precaución, puede romper cosas
    npm audit fix --force || true # Usamos || true para no detener el script si falla

    setup_next_config # Re-ejecutar por si acaso, aunque ya se hace en main

    echo "Ejecutando 'npm run build'..."
    # Añadir || true para que no falle el script si el build tiene warnings pero no errores fatales
    npm run build || true

    echo "🔹 Configuración de React completada."
}


# Instalar Portainer
install_portainer() {
    echo "🔹 Instalando Portainer CE (Community Edition)..."

    # Verificar si Portainer ya está instalado (contenedor existe)
    if docker inspect $PORTAINER_CONTAINER_NAME > /dev/null 2>&1; then
        echo "Contenedor Portainer '$PORTAINER_CONTAINER_NAME' ya existe. Saltando instalación."
        # Opcional: añadir lógica para actualizar si es necesario
        # docker stop $PORTAINER_CONTAINER_NAME
        # docker rm $PORTAINER_CONTAINER_NAME
        # docker pull portainer/portainer-ce:latest
        # docker run ... (volver a ejecutar el comando de run)
    else
        echo "Creando volumen de datos para Portainer..."
        # Usamos || true para que no falle si el volumen ya existe (aunque la mayoría de las veces fallaría el docker run después)
        docker volume create $PORTAINER_DATA_VOLUME || true

        echo "Desplegando contenedor Portainer..."
        # Se mapean los puertos 8000 (Edge Agent) y 9443 (UI HTTPS).
        # Se mapea /var/run/docker.sock para que Portainer pueda hablar con el demonio Docker.
        # Se mapea el volumen de datos para persistencia.
        docker run -d \
            -p $PORTAINER_PORT_HTTP:$PORTAINER_PORT_HTTP \
            -p $PORTAINER_PORT_HTTPS:$PORTAINER_PORT_HTTPS \
            --name $PORTAINER_CONTAINER_NAME \
            --restart always \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v $PORTAINER_DATA_VOLUME:/data \
            portainer/portainer-ce:latest

        echo "Portainer debería estar instalándose en segundo plano."
        echo "Accede a https://<IP_Raspberry>:$PORTAINER_PORT_HTTPS después de la instalación para la configuración inicial."
    fi

    echo "🔹 Instalación de Portainer completada (o verificado que ya existía)."
}


# Crear servicio de Flask
setup_flask_service() {
    echo "🔹 Creando servicio Systemd para Flask..."
    # Asegurarse de que el directorio del backend existe antes de crear el servicio
    mkdir -p "$BACKEND_DIR"
    # Contenido exacto del servicio systemd proporcionado originalmente
    sudo tee /etc/systemd/system/flask.service > /dev/null <<EOF
[Unit]
Description=Flask App
After=network.target docker.service # Aseguramos que docker esté corriendo antes

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
   echo "Archivo de servicio Flask creado."
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

    # Eliminar el site por defecto de Nginx para evitar conflictos
    if [ -f /etc/nginx/sites-enabled/default ]; then
        echo "Eliminando site por defecto de Nginx..."
        sudo rm /etc/nginx/sites-enabled/default
    fi

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
    create 0640 $USER www-data # Asegurarse que el usuario y grupo pueden leer/escribir los logs
}
EOF
   echo "Archivo logrotate creado."
}

# Habilitar y arrancar servicios
enable_and_start_services() {
    echo "🔹 Habilitando y arrancando servicios..."
    sudo systemctl daemon-reload
    sudo systemctl enable --now flask.service
    echo "Servicio Flask iniciado."

    # También habilitamos y arrancamos Docker por si no lo estaba
    sudo systemctl enable --now docker.service
    echo "Servicio Docker habilitado y corriendo."

    # Esperamos un poco para que Docker se estabilice antes de verificar Portainer
    sleep 5
    echo "Esperando un momento para Docker..."

    # Verificar si Portainer arrancó correctamente (opcional, pero útil)
    if docker ps | grep -q $PORTAINER_CONTAINER_NAME; then
        echo "✅ Contenedor Portainer corriendo."
    else
        echo "❌ Error: Contenedor Portainer no parece estar corriendo. Revisa los logs de Docker."
        # Opcional: mostrar logs de Portainer
        # docker logs $PORTAINER_CONTAINER_NAME
    fi

    echo "🔹 Servicios habilitados y arrancados."
}

# Mensaje final
instructions() {
    echo ""
    echo "✅ Instalación de NASPi base completada."
    echo ""
    echo "!!! PASOS FINALES IMPORTANTES !!!"
    echo "--------------------------------"
    echo "1. CIERRA Y VUELVE A ABRIR TU SESIÓN SSH para que los permisos del grupo 'docker' surtan efecto."
    echo "2. CREA o ACTUALIZA el archivo .env en el directorio del backend ($BACKEND_DIR):"
    echo "   Necesitarás tus credenciales de Portainer y una clave secreta para el backend."
    echo "   Crea el archivo con el siguiente contenido (reemplaza los valores entre < >):"
    echo "   -------------------------------------------------------------------------"
    echo "   PORTAINER_URL=https://<IP_Raspberry>:$PORTAINER_PORT_HTTPS"
    echo "   PORTAINER_USERNAME=<tu_usuario_portainer>"
    echo "   PORTAINER_PASSWORD=<tu_password_portainer>"
    echo "   PORTAINER_ENVIRONMENT_ID=1 # Confirma si tu entorno Docker es el ID 1 en Portainer"
    echo "   ADMIN_API_KEY=<una_clave_admin_aleatoria_muy_segura>" # Genera una clave larga y aleatoria
    echo "   -------------------------------------------------------------------------"
    echo "3. Accede a Portainer por primera vez para configurar el usuario administrador:"
    echo "   🌐 https://<IP_Raspberry>:$PORTAINER_PORT_HTTPS"
    echo "4. (Opcional pero recomendado) Dentro de Portainer, crea un usuario de API dedicado o un token de API si tu versión lo permite, con permisos solo para gestionar stacks/contenedores en el entorno relevante. Usa esas credenciales en el archivo .env en lugar de tu usuario/password principal."
    echo "5. Reinicia el servicio Flask después de crear/actualizar el .env:"
    echo "   sudo systemctl restart flask.service"
    echo ""
    echo "Una vez completados los pasos finales, podrás acceder a:"
    echo "🌐 Tu NASPi App (React + Flask API): http://naspi.local (o la IP de tu Raspberry Pi)"
    echo "🛠️ Portainer UI: https://<IP_Raspberry>:$PORTAINER_PORT_HTTPS"
    echo "📡 Flask API Directo (si no usas Nginx o para debug): http://<IP_Raspberry>:$FLASK_PORT/api/"
    echo "🛠️ OMV: http://naspi.local:$OMV_PORT (si instalaste OMV aparte)"
    echo ""
}

permisos_extra() {
    echo "🔹 Configurando permisos extra..."
    
    if [ -f "$BACKEND_DIR/data/users.json" ]; then
        sudo chmod 660 "$BACKEND_DIR/data/users.json" # Permitir leer/escribir al propietario y grupo
        sudo chown $USER:$USER "$BACKEND_DIR/data/users.json" # Asegurar que el usuario del backend es el propietario
        sudo chown $USER:www-data "$BACKEND_DIR/data/users.json" si quieres que www-data tenga acceso
    else
         echo "Advertencia: Archivo data/users.json no encontrado en $BACKEND_DIR. Si usas autenticación basada en archivos, créalo."
    fi
    echo "Permisos de users.json configurados (si el archivo existe)."

    # Permisos para el directorio de datos del backend si es necesario
    if [ -d "$BACKEND_DIR/data" ]; then
         sudo chown $USER:$USER "$BACKEND_DIR/data"
         sudo chmod 775 "$BACKEND_DIR/data"
    fi


    # Permisos para que www-data (Nginx) pueda acceder a los directorios padre
    sudo chmod +x /home/$USER
    sudo chmod +x "$PROJECT_DIR"
    sudo chmod +x "$PROJECT_DIR/naspi"
    sudo chmod +x "$FRONTEND_DIR"
    sudo chmod +x "$FRONTEND_DIR/out"

    # Permiso setgid en /mnt/raid/files/ (si lo usas) para que los nuevos archivos hereden el grupo
    sudo chmod g+s /mnt/raid/files/ || true # Usamos || true por si la ruta no existe
    echo "Permisos extra aplicados."
}

# Limpieza inicial
initial_cleanup() {
    echo "🚀 Iniciando limpieza de caches y directorios de instalación previos..."

    # Limpiar caché de APT
    echo "🔹 Limpiando caché de APT..."
    sudo apt clean
    sudo apt autoremove -y || true # autoremove puede fallar si no hay nada que remover

    # Limpiar caché de npm (forzado para asegurar una limpieza profunda)
    echo "🔹 Limpiando caché de npm..."
    # Usamos || true para que el script no falle si hay un error menor en la limpieza
    npm cache clean --force || true

    # Eliminar directorio node_modules en el frontend para forzar una instalación limpia desde cero
    if [ -d "$FRONTEND_DIR/node_modules" ]; then
        echo "🔹 Eliminando directorio node_modules en el frontend..."
        rm -rf "$FRONTEND_DIR/node_modules"
    fi

    # Eliminar entorno virtual Python para forzar una instalación limpia
    if [ -d "$VENV_DIR" ]; then
        echo "🔹 Eliminando entorno virtual Python en el backend..."
        rm -rf "$VENV_DIR"
    fi


    echo "✅ Limpieza completada. Procediendo con la instalación..."
    echo "" # Línea en blanco para mejor legibilidad en la salida
}

# Ejecutar instalación
main() {
    initial_cleanup
    install_dependencies
    setup_git
    setup_flask
    setup_react
    setup_flask_service
    setup_nginx
    setup_logrotate
    # NOTA: La instalación de Portainer se hace antes de arrancar servicios principales
    # porque el servicio Flask puede depender de la existencia de Docker/Portainer.
    install_portainer # NUEVA FUNCIÓN para instalar Portainer
    enable_and_start_services
    permisos_extra # Ejecutar después de configurar todo

    instructions # Mensaje final con pasos IMPORTANTES
    echo "✅ Proceso de instalación principal finalizado."
}

# --- Ejecutar el script ---
main