from flask import Flask, request, jsonify, send_from_directory
import os

app = Flask(__name__)

# Ruta donde están montados los SSD (puedes ajustar esto según tu configuración)
RAID_PATH = "/mnt/raid"

# Crear la carpeta RAID si no existe (útil para pruebas locales)
os.makedirs(RAID_PATH, exist_ok=True)

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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
