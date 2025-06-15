from flask import Flask, request, jsonify
import os
import json
import sqlite3
import pymongo
import pyodbc
from dotenv import load_dotenv
from flask_cors import CORS
import logging

app = Flask(__name__)
CORS(app)
load_dotenv()

logging.basicConfig(filename='api-server.log', level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

schema_info = None

# Database factory (simplified)
def create_database(config):
    if config['type'] == 'sqlite':
        return sqlite3.connect(config['path'])
    elif config['type'] == 'mongodb':
        client = pymongo.MongoClient(config['url'])
        return client[config['dbName']]
    elif config['type'] == 'mssql':
        return pyodbc.connect(
            f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config['server']};"
            f"DATABASE={config['database']};UID={config['user']};PWD={config['password']}"
        )

def generate_schema_info(db):
    if isinstance(db, sqlite3.Connection):
        cursor = db.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table';")
        return '\n'.join(row[0] for row in cursor.fetchall())
    elif isinstance(db, pymongo.database.Database):
        return str(db.list_collection_names())
    elif isinstance(db, pyodbc.Connection):
        cursor = db.cursor()
        return '\n'.join(str(row) for row in cursor.tables())
    return "Schema not implemented"

@app.route('/api/load-db', methods=['POST'])
def load_db():
    global schema_info
    try:
        db_type = request.form.get('type') or (request.json.get('type') if request.json else None)
        if not db_type:
            return jsonify({'success': False, 'error': 'Database type not provided'}), 400
        config = {'type': db_type}
        
        if db_type == 'sqlite':
            file = request.files.get('dbFile')
            logger.info(f"Received db_type: {db_type}")
            logger.info(f"Received file: {file.filename if file else 'None'}")
            if not file:
                return jsonify({'success': False, 'error': 'No file uploaded for SQLite'}), 400
            db_path = os.path.join('uploads', 'current.db')
            file.save(db_path)
            config['path'] = db_path
            config['name'] = file.filename
        elif db_type == 'mssql':
            config.update(request.json)
            required = ['server', 'database', 'user', 'password']
            if not all(k in config for k in required):
                return jsonify({'success': False, 'error': 'Missing MSSQL connection details'}), 400
        elif db_type == 'mongodb':
            config.update(request.json)
            required = ['url', 'dbName']
            if not all(k in config for k in required):
                return jsonify({'success': False, 'error': 'Missing MongoDB connection details'}), 400
        else:
            return jsonify({'success': False, 'error': 'Unsupported database type'}), 400
        
        db = create_database(config)
        schema_info = generate_schema_info(db)
        with open('schema.txt', 'w') as f:
            f.write(schema_info)
        with open('db-config.txt', 'w') as f:
            json.dump(config, f)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/is-db-loaded', methods=['GET'])
def is_db_loaded():
    try:
        if os.path.exists('schema.txt'):
            with open('db-config.txt', 'r') as f:
                config = json.load(f)
            db_name = config.get('name', config.get('database', config.get('dbName', 'Unknown')))
            return jsonify({'loaded': True, 'dbName': db_name})
        return jsonify({'loaded': False})
    except Exception:
        return jsonify({'loaded': False})

if __name__ == '__main__':
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    app.run(port=3001, debug=True)