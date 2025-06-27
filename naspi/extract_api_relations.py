import os
import re
import csv

# ---------- CONFIG ----------
FRONTEND_DIR = 'frontend'
BACKEND_DIR = 'backend'
OUTPUT_FILE = 'api_relations.csv'

# ---------- FRONTEND PARSER ----------
def extract_frontend_calls():
    api_calls = []
    for root, _, files in os.walk(FRONTEND_DIR):
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    matches = re.findall(r"(fetch|axios\.(get|post|put|delete))\((['\"])(/[^'\"]+)", content)
                    for m in matches:
                        method = 'GET' if m[0] == 'fetch' else m[1].upper()
                        url = m[3]
                        api_calls.append({
                            'type': 'Frontend → API',
                            'method': method,
                            'url': url,
                            'file': path
                        })
    return api_calls

# ---------- BACKEND PARSER ----------
def extract_backend_routes():
    endpoints = []
    for root, _, files in os.walk(BACKEND_DIR):
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    matches = re.findall(r"@(?:app|[\w_]+_bp)?\.route\((['\"])([^'\"]+)\1(?:,\s*methods\s*=\s*\[([^\]]+)\])?", content)
                    for m in matches:
                        url = m[1]
                        methods = m[2].replace("'", "").replace('"', "").split(',') if m[2] else ['GET']
                        for method in methods:
                            endpoints.append({
                                'type': 'API Endpoint',
                                'method': method.strip().upper(),
                                'url': url,
                                'file': path
                            })
    return endpoints

# ---------- WRITE TO CSV ----------
def write_csv(frontend_calls, backend_routes):
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['type', 'method', 'url', 'file'])
        writer.writeheader()
        for row in frontend_calls + backend_routes:
            writer.writerow(row)

# ---------- MAIN ----------
if __name__ == '__main__':
    fe_calls = extract_frontend_calls()
    be_routes = extract_backend_routes()
    write_csv(fe_calls, be_routes)
    print(f'✅ Análisis completado. Archivo generado: {OUTPUT_FILE}')
