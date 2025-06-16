from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from functools import wraps
from werkzeug.utils import secure_filename
import time
import os
import subprocess
import json
import uuid
import bcrypt
import Info_checker as info
import NAS_status as NASStatus
import shutil  # Importamos shutil para eliminar carpetas
import traceback  # Esto ayuda a capturar errores detallados

app = Flask(__name__)
CORS(app, origins="http://naspi.local", supports_credentials=True, methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type", "X-Admin-API-Key"])

# Configuración del sistema de archivos
RAID_PATH = "/mnt/raid/files"
CHUNK_UPLOAD_DIR = "/mnt/raid/tmp_chunks"  # Carpeta temporal
portainer_manager = None
has_attempted_restart = False

if not os.path.exists(RAID_PATH):
    os.makedirs(RAID_PATH)

if not os.path.exists(CHUNK_UPLOAD_DIR):
    os.makedirs(CHUNK_UPLOAD_DIR)

# Configuración del archivo de usuarios
USERS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'users.json')

if not os.path.exists(USERS_FILE):
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, indent=2)

ALLOWED_EXTENSIONS = {
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 
    'ppt', 'pptx', 'zip', 'rar', '7z', 'tar', 'gz', 'tar.gz', 'mp4', 'avi', 'mkv', 'mov', 'wmv'
}

app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024 * 1024  # 20GB

# Utilidades de usuario
def read_users():
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=2)

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
#------------------------------------------------------------------------------------------------------------------
# Ruta para reiniciar NASPi
# POST:method --> /api/reboot
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/reboot', methods=['POST'])
def reboot():
    try:
        # Puedes proteger esto con autenticación si lo deseas
        subprocess.Popen(['sudo', 'reboot'])
        return jsonify({"message": "Reiniciando NASPi..."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para apagar NASPi
# POST:method --> /api/shutdown
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    try:
        subprocess.Popen(['sudo', 'shutdown', '-h', 'now'])
        return jsonify({"message": "Apagando NASPi..."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para listar archivos
# GET:method --> /api/files --> files
#------------------------------------------------------------------------------------------------------------------
# Rutas API
@app.route('/api/files', methods=['GET'])
def list_files():
    try:
        current_path = request.args.get('path', '').strip('/')
        directory = os.path.join(RAID_PATH, current_path)

        if not os.path.exists(directory) or not os.path.isdir(directory):
            return jsonify({"error": "Directorio no encontrado"}), 404

        files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
        folders = [f for f in os.listdir(directory) if os.path.isdir(os.path.join(directory, f))]

        return jsonify({"files": files, "folders": folders, "path": current_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para listar archivos
# GET:method --> /api/nas_status --> files
#------------------------------------------------------------------------------------------------------------------
# Rutas API
@app.route('/api/nas_status', methods=['GET'])
def NAS_Status():
    DEVICES = ["/dev/sda", "/dev/sdb", "/dev/sdc"]
    try:
        ssd_status = NASStatus.get_smart_status()
        dev_speed = []
        for dev in DEVICES:
            dev_speed.append(NASStatus.get_disk_speed(dev))
    
        dev_info = dict(status=ssd_status,speed=dev_speed)
        return jsonify(dev_info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para gestionar el login
# POST:method --> /api/login --> acceder
#------------------------------------------------------------------------------------------------------------------  
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        users = read_users()
        user = next((u for u in users if u["username"] == username), None)

        # Comparar contraseñas sin hash
        if user and check_password(password,user["password"]):
            return jsonify({
                "message": "Login successful",
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "role": user["role"]
                }
            })
        else:
            return jsonify({"message": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para gestionar users
# GET:method, users.json --> /api/users --> user
# DELETE:method, user --> /api/users --> users.json
# POST:method, user --> /api/users --> users.json
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/users', methods=['GET', 'POST', 'DELETE'])
def users():
    try:
        if request.method == 'POST':
            data = request.get_json()
            username = data.get("username")
            password = data.get("password")
            role = data.get("role", "user")

            users = read_users()
            if any(user["username"] == username for user in users):
                return jsonify({"message": "Username already exists"}), 400

            new_user = {
                "id": str(uuid.uuid4()),
                "username": username,
                "password": hash_password(password),
                "role": role
            }

            users.append(new_user)
            save_users(users)

            return jsonify({"message": "User added successfully"}), 201

        elif request.method == 'GET':
            users = read_users()
            safe_users = [{"id": user["id"], "username": user["username"], "role": user["role"]} for user in users]
            return jsonify(safe_users), 200

        elif request.method == 'DELETE':
            user_id = request.args.get("id")
            if not user_id:
                return jsonify({"message": "Valid user ID is required"}), 400

            users = read_users()
            updated_users = [user for user in users if user["id"] != user_id]

            if len(updated_users) == len(users):
                return jsonify({"message": "User not found"}), 404

            save_users(updated_users)
            return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para descargar un archivo
# GET:method --> /api/files/<filename> --> file
# DELETE:method --> /api/files/<filename> --> Eliminar archivo
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/files/<path:filename>', methods=['GET', 'DELETE'])
def file_operations(filename):
    file_path = os.path.join(RAID_PATH, filename)  # No uses secure_filename aquí

    if request.method == 'GET':
        try:
            dir_path = os.path.dirname(filename)  # Extraer la carpeta del archivo
            file_name = os.path.basename(filename)  # Extraer solo el nombre del archivo
            return send_from_directory(os.path.join(RAID_PATH, dir_path), file_name, as_attachment=True)

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == 'DELETE':
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return jsonify({"message": "Archivo eliminado con éxito"}), 200
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        else:
            return jsonify({"error": "Archivo no encontrado"}), 404
#------------------------------------------------------------------------------------------------------------------
# Ruta para subir un archivo
# POST:method, file --> /api/files
#------------------------------------------------------------------------------------------------------------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST'])
def upload():
    try:
        if 'files' not in request.files:
            return jsonify({"message": "No file part"}), 400

        files = request.files.getlist('files')  # Obtener lista de archivos
        current_path = request.form.get('path', '')  # Obtener la ruta actual
        print(f"Upload Path: {current_path}")  # Para debug
        upload_dir = os.path.join(RAID_PATH, current_path) if current_path else RAID_PATH

        # Crear la carpeta si no existe
        os.makedirs(upload_dir, exist_ok=True)

        uploaded_files = []

        for file in files:
            if file.filename == '':
                continue
            filepath = os.path.join(upload_dir, file.filename)
            file.save(filepath)
            uploaded_files.append(file.filename)

        return jsonify({"message": "Files uploaded successfully", "files": uploaded_files})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload_chunk', methods=['POST'])
def upload_chunk():
    try:
        chunk = request.files['chunk']
        filename = request.form['filename']
        chunk_index = int(request.form['chunkIndex'])
        total_chunks = int(request.form['totalChunks'])
        current_path = request.form.get('path', '')

        upload_dir = os.path.join(RAID_PATH, current_path) if current_path else RAID_PATH
        os.makedirs(upload_dir, exist_ok=True)

        temp_filename = os.path.join(upload_dir, f".{filename}.uploading")
        final_filename = os.path.join(upload_dir, filename)

        # Guardar cada chunk en el archivo temporal
        with open(temp_filename, 'ab') as f:
            f.write(chunk.read())

        # Verificar si es el último chunk
        if chunk_index == total_chunks - 1:
            os.rename(temp_filename, final_filename)
            return jsonify({"message": "Archivo subido completamente."}), 200

        return jsonify({"message": f"Chunk {chunk_index + 1} recibido."}), 200

    except Exception as e:
        # 🚨 Si ocurre un error, intentamos limpiar el archivo temporal
        try:
            filename = request.form.get('filename', 'unknown')
            current_path = request.form.get('path', '')
            upload_dir = os.path.join(RAID_PATH, current_path) if current_path else RAID_PATH
            temp_file = os.path.join(upload_dir, f".{filename}.uploading")
            if os.path.exists(temp_file):
                os.remove(temp_file)
        except Exception as cleanup_error:
            print(f"[ERROR] No se pudo eliminar archivo temporal: {cleanup_error}")

        print(f"[ERROR] Fallo en subida de chunk: {e}")
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para cancelar el archivo, o archivos, que se esté subiendo
# POST --> cancel_upload()
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/cancel_upload', methods=['POST'])
def cancel_upload():
    try:
        filename = request.json.get('filename')
        current_path = request.json.get('path', '')
        if not filename:
            return jsonify({"error": "Falta el nombre del archivo"}), 400

        upload_dir = os.path.join(RAID_PATH, current_path) if current_path else RAID_PATH
        temp_file = os.path.join(upload_dir, f".{filename}.uploading")

        if os.path.exists(temp_file):
            os.remove(temp_file)
            return jsonify({"message": f"Subida de '{filename}' cancelada y archivo temporal eliminado."}), 200
        else:
            return jsonify({"message": "No se encontró archivo temporal para eliminar."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para crear una carpeta
# POST:method, name:string --> /api/create_folder
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/create_folder', methods=['POST'])
def create_folder():
    try:
        data = request.get_json()
        folder_name = data.get("folder_name")
        current_path = data.get("current_path", "").strip("/")

        if not folder_name or folder_name.lower() == "lost+found":
            return jsonify({"error": "Invalid folder name"}), 400

        folder_path = os.path.join(RAID_PATH, current_path, folder_name) if current_path else os.path.join(RAID_PATH, folder_name)
        os.makedirs(folder_path, exist_ok=True)

        return jsonify({"message": f"Carpeta '{folder_name}' creada en '{current_path}'", "folder": folder_name})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para eliminar una carpeta
# DELETE:method --> /api/files/<path:filename
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/folders/<path:foldername>', methods=['DELETE'])
def delete_folder(foldername):
    folder_path = os.path.join(RAID_PATH, foldername)

    if not os.path.exists(folder_path):
        return jsonify({"error": "Carpeta no encontrada"}), 404

    if not os.path.isdir(folder_path):
        return jsonify({"error": "No es una carpeta válida"}), 400

    try:
        shutil.rmtree(folder_path)  # 🔥 Elimina la carpeta y todo su contenido
        return jsonify({"message": f"Carpeta eliminada correctamente: {foldername}"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para recoger datos de telematica
# GET:method --> /api/telematic --> [ip,gateway,mask]]
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/telematic', methods=['GET'])
def get_telematic():
    try:
        data = info.get_telematic_info()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para recoger datos de hardware
# GET:method --> /api/hardware --> [CPU usada, Temp CPU, RAM usada, Uso del disco]]
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/hardware', methods=['GET'])
def get_hardware():
    try:
        data = info.get_hardware_info()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#------------------------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------------------------

# PORTAINER CONFIGURATION AND ROUTES

#------------------------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------------------------

import sys
from dotenv import load_dotenv

# Cargar variables de entorno
backend_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(backend_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

# Agregar el backend al sys.path por si portainer_manager está en el mismo dir
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

try:
    from portainer_manager import PortainerManager
except ImportError as e:
    print(f"Error al importar PortainerManager: {e}")
    PortainerManager = None

PORTAINER_URL = os.getenv('PORTAINER_URL')
PORTAINER_USERNAME = os.getenv('PORTAINER_USERNAME')
PORTAINER_PASSWORD = os.getenv('PORTAINER_PASSWORD')
try:
    PORTAINER_ENVIRONMENT_ID = int(os.getenv('PORTAINER_ENVIRONMENT_ID', 1))
except (ValueError, TypeError):
    PORTAINER_ENVIRONMENT_ID = 1

ADMIN_API_KEY = os.getenv('ADMIN_API_KEY')
if not ADMIN_API_KEY or ADMIN_API_KEY == 'replace_with_a_secure_random_key':
    print("Advertencia: ADMIN_API_KEY no configurada correctamente.")

def is_admin(api_key):
    return api_key is not None and ADMIN_API_KEY is not None and api_key == ADMIN_API_KEY

def require_admin(func):
    from functools import wraps
    @wraps(func)
    def decorated_function(*args, **kwargs):
        admin_key = request.headers.get('X-Admin-API-Key')
        if not is_admin(admin_key):
            return jsonify({"success": False, "message": "Autenticación requerida"}), 401
        return func(*args, **kwargs)
    return decorated_function

def check_portainer_manager(func):
    @wraps(func)
    def decorated_function(*args, **kwargs):
        global portainer_manager

        max_retries = 5
        delay = 2  # segundos entre intentos

        if portainer_manager is None and PortainerManager and all([PORTAINER_URL, PORTAINER_USERNAME, PORTAINER_PASSWORD, ADMIN_API_KEY]):
            for attempt in range(max_retries):
                try:
                    print(f"🔁 Intentando inicializar PortainerManager (intento {attempt + 1}/{max_retries})...")
                    portainer_manager = PortainerManager(PORTAINER_URL, PORTAINER_USERNAME, PORTAINER_PASSWORD, PORTAINER_ENVIRONMENT_ID)
                    print("✅ PortainerManager inicializado correctamente.")
                    break
                except Exception as e:
                    print(f"⚠️ Fallo al inicializar PortainerManager: {e}")
                    time.sleep(delay)

        if portainer_manager is None:
            return jsonify({"success": False, "message": "PortainerManager no está disponible"}), 503

        return func(*args, **kwargs)
    return decorated_function
# RUTAS API PARA PORTAINER
@app.route('/api/admin/available-services', methods=['GET'])
@require_admin
@check_portainer_manager
def get_available_services_route():
    result, status_code = portainer_manager.get_available_services()
        # Renombrar la clave para que el frontend la entienda
    if "services" in result:
        result["available_services"] = result.pop("services")
    return jsonify(result), status_code

@app.route('/api/admin/install/<service_name>', methods=['POST'])
@require_admin
@check_portainer_manager
def install_service_route(service_name):
    result, status_code = portainer_manager.install_service(service_name.lower())
    return jsonify(result), status_code

@app.route('/api/admin/uninstall/<service_name>', methods=['DELETE'])
@require_admin
@check_portainer_manager
def uninstall_service_route(service_name):
    result, status_code = portainer_manager.uninstall_service(service_name.lower())
    return jsonify(result), status_code

@app.route('/api/services', methods=['GET'])
@check_portainer_manager
def list_services_route():
    result, status_code = portainer_manager.list_installed_services()
    return jsonify(result), status_code

@app.route('/api/services/start/<service_name>', methods=['POST'])
@check_portainer_manager
def start_service_route(service_name):
    result, status_code = portainer_manager.start_service(service_name.lower())
    return jsonify(result), status_code

@app.route('/api/services/stop/<service_name>', methods=['POST'])
@check_portainer_manager
def stop_service_route(service_name):
    result, status_code = portainer_manager.stop_service(service_name.lower())
    return jsonify(result), status_code

#------------------------------------------------------------------------------------------------------------------
# MANEJO GLOBAL DE ERRORES
#------------------------------------------------------------------------------------------------------------------
@app.errorhandler(401)
def unauthorized_error(error):
    return jsonify({"success": False, "message": "No autorizado"}), 401

@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith('/api/'):
        return jsonify({"success": False, "message": f"Ruta no encontrada: {request.path}"}), 404
    return error

@app.errorhandler(500)
def internal_error(error):
    traceback.print_exc()
    return jsonify({"success": False, "message": "Error interno del servidor"}), 500

@app.errorhandler(503)
def service_unavailable_error(error):
    return jsonify({"success": False, "message": "Servicio Portainer no disponible"}), 503

#------------------------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
