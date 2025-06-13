from flask import Flask, request, jsonify, send_from_directory
from mcp_sdk import Client, StdioClientTransport  # Hypothetical MCP Python SDK
import os
import json
import asyncio

app = Flask(__name__, static_folder='static')

# MCP Client Setup
transport = StdioClientTransport(command='python', args=['mcp_server.py'])
client = Client(name='web-client', version='1.0.0')
is_client_connected = False

async def connect_with_retry(retries=5, delay=1000):
    global is_client_connected
    for i in range(retries):
        try:
            await client.connect(transport)
            print('Connected to MCP server')
            is_client_connected = True
            return True
        except Exception as e:
            print(f'Connection attempt {i+1} failed: {e}')
            if i < retries - 1:
                await asyncio.sleep(delay / 1000)
    print('Failed to connect to MCP server after retries')
    return False

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/query', methods=['POST'])
async def query():
    if not is_client_connected:
        return jsonify({'error': 'MCP server not yet connected, please try again later'}), 503
    
    data = request.json
    query, ai_provider, include_query, include_explanation, include_results = (
        data['query'], data['aiProvider'], data['includeQuery'], data['includeExplanation'], data['includeResults']
    )
    
    try:
        start_time = time.time()
        result = await client.call_tool(
            name='query_database',
            arguments={
                'query': query,
                'aiProvider': ai_provider,
                'includeQuery': include_query,
                'includeExplanation': include_explanation,
                'includeResults': include_results
            }
        )
        duration = (time.time() - start_time) * 1000
        print(f'Query "{query}" processed in {duration:.2f}ms')
        
        content = json.loads(result['content'][0]['text'])
        if result.get('isError'):
            return jsonify({'error': content}), 400
        return jsonify(content)
    except Exception as e:
        print(f'Query failed: {e}')
        return jsonify({'error': str(e)}), 500

# Proxy routes to api_server
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1)

if __name__ == '__main__':
    asyncio.run(connect_with_retry())
    app.run(port=3000, debug=True)