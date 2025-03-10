from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS  # Importar CORS
import os
import json
import uuid
import Info_checker as info

app = Flask(__name__)
CORS(app)  # Habilitar CORS en toda la app

# Ruta donde están montados los SSD (puedes ajustar esto según tu configuración)
RAID_PATH = "/mnt/raid"

# Ruta al archivo de usuarios
USERS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'users.json')

# Crear la carpeta RAID si no existe (útil para pruebas locales)
if not os.path.ismount(RAID_PATH):
    raise RuntimeError(f"El RAID no está montado en {RAID_PATH}. Asegúrate de configurarlo en OMV antes de ejecutar la aplicación.")

#------------------------------------------------------------------------------------------------------------------
# Ruta para listar archivos
# GET:method --> /api/files --> files
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/files', methods=['GET'])
def list_files():
    try:
        files = os.listdir(RAID_PATH)
        return jsonify(files)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para gestionar el login
# POST:method --> /api/login --> acceder
#------------------------------------------------------------------------------------------------------------------  
@app.route('/api/login', methods=['POST'])
def login():
    try:
        # Obtener datos del request
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        # Leer usuarios desde users.json
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            users = json.load(f)

        # Buscar usuario
        user = next((u for u in users if u["username"] == username and u["password"] == password), None)

        if user:
            # En una app real, aquí se generaría un token JWT
            return jsonify({"message": "Login successful", "user": {"id": user["id"], "username": user["username"], "role": user["role"]}})
        else:
            return jsonify({"message": "Invalid credentials"}), 401

    except Exception as e:
        return jsonify({"message": "Error processing request", "error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para gestionar users
# GET:method, users.json --> /api/users --> user
# DELETE:method, user --> /api/users --> users.json
# POST:method, user --> /api/users --> users.json
#------------------------------------------------------------------------------------------------------------------
# Función para leer usuarios
def read_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

# Función para guardar usuarios
def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=2)

@app.route('/api/users', methods=['GET', 'POST', 'DELETE'])
def users():
    try:
        if request.method == 'POST':
            data = request.get_json()
            username = data.get("username")
            password = data.get("password")  # ⚠️ En una app real, esto debe estar hasheado
            role = data.get("role", "user")

            users = read_users()

            # Verificar si el usuario ya existe
            if any(user["username"] == username for user in users):
                return jsonify({"message": "Username already exists"}), 400

            # Crear nuevo usuario
            new_user = {
                "id": str(uuid.uuid4()),
                "username": username,
                "password": password,  # ⚠️ Sin hash por ahora
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
        return jsonify({"message": "Error processing request", "error": str(e)}), 500
#------------------------------------------------------------------------------------------------------------------
# Ruta para descargar un archivo
# GET:method --> /api/files/<filename> --> file
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/files/<filename>', methods=['GET'])
def download_file(filename):
    try:
        return send_from_directory(RAID_PATH, filename, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#------------------------------------------------------------------------------------------------------------------
# Ruta para subir un archivo
# POST:method, file --> /api/files
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/files', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    try:
        file.save(os.path.join(RAID_PATH, file.filename))
        return jsonify({"message": "File uploaded successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#------------------------------------------------------------------------------------------------------------------
# Ruta para recoger datos de telematica
# GET:method --> /api/telematic --> [ip,gateway,mask]]
#------------------------------------------------------------------------------------------------------------------
@app.route('/api/telematic', methods=['GET'])
def get_telematic():
    try:
        # Recoger datos
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
        # Recoger datos
        data = info.get_hardware_info()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#------------------------------------------------------------------------------------------------------------------
#------------------------------------------------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
