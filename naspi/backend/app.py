from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
import uuid
import bcrypt
import Info_checker as info
import NAS_status as NASStatus
import shutil  # Importamos shutil para eliminar carpetas
import traceback  # Esto nos ayudará a capturar errores detallados

app = Flask(__name__)
CORS(app, supports_credentials=True, methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"])

# Configuración del sistema de archivos
RAID_PATH = "/mnt/raid/files"

if not os.path.exists(RAID_PATH):
    os.makedirs(RAID_PATH)

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
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
