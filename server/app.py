from flask import Flask, request, jsonify, send_from_directory
from mcp_sdk import Client, StdioClientTransport
import os
import json
import asyncio
import time
from asgiref.wsgi import WsgiToAsgi
import uvicorn
import threading
import atexit
import subprocess
import logging

BASE_DIR   = os.path.dirname(__file__)  
STATIC_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'static'))
MCP_SERVER_PATH = os.path.join(BASE_DIR, 'mcp_server.py')

app = Flask(__name__,static_folder=STATIC_DIR,static_url_path='')

logging.basicConfig(filename='app.log', level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

transport = StdioClientTransport(command='python', args=[MCP_SERVER_PATH])
client = Client(name='web-client', version='1.0.0')
is_client_connected = False

loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

def connect_mcp_client():
    global is_client_connected
    try:
        loop.run_until_complete(client.connect(transport))
        is_client_connected = True
        logger.info('Connected to MCP server')
    except Exception as e:
        logger.error(f'Failed to connect to MCP server: {e}')

@app.route('/api/query', methods=['POST'])
def query():
    if not is_client_connected:
        return jsonify({'error': 'MCP server not yet connected, please try again later'}), 503
    
    data = request.json
    query, ai_provider, include_query, include_explanation, include_results = (
        data['query'], data['aiProvider'], data['includeQuery'], data['includeExplanation'], data['includeResults']
    )
    
    try:
        start_time = time.time()
        logger.info(f'Sending request to MCP server: {json.dumps({"type": "call_tool", "name": "query_database", "arguments": {"query": query, "aiProvider": ai_provider, "includeQuery": include_query, "includeExplanation": include_explanation, "includeResults": include_results}})}')
        result = loop.run_until_complete(client.call_tool(
            name='query_database',
            arguments={
                'query': query,
                'aiProvider': ai_provider,
                'includeQuery': include_query,
                'includeExplanation': include_explanation,
                'includeResults': include_results
            }
        ))
        logger.info(f'Received response from MCP server: {result}')
        duration = (time.time() - start_time) * 1000
        logger.info(f'Query "{query}" processed in {duration:.2f}ms')
        
        try:
            response_text = result['content'][0]['text']
            if not response_text.strip():
                raise ValueError('Empty response from MCP server')
            content = json.loads(response_text)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f'Error processing MCP server response: {e}')
            return jsonify({'error': 'Invalid or empty response from MCP server'}), 500
        if result.get('isError'):
            return jsonify({'error': content}), 400
        return jsonify(content)
    except Exception as e:
        logger.error(f'Query failed: {e}')
        return jsonify({'error': str(e)}), 500

# Proxy routes to api_server
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

if __name__ == '__main__':
    connect_mcp_client()  # Connect the MCP client at startup
    app.run(port=3000, debug=True)