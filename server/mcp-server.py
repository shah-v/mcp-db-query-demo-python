import os
import json
import logging
from typing import Dict, List, Union, Any
from dotenv import load_dotenv
from mcp_sdk import McpServer, StdioServerTransport
import sqlite3
import pymongo
import pyodbc
from google import genai
import requests
import re

# Load environment variables
load_dotenv()

# Logging setup
logging.basicConfig(filename='mcp-server.log', level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

# Global variables
schema_info = None
sql_cache: Dict[str, Union[str, dict]] = {}
result_cache: Dict[str, List[Any]] = {}

# Database instance
db = None

def generate_query_prompt(params: dict) -> str:
    schema_info = params['schemaInfo']
    mode = params['mode']
    user_query = params['userQuery']
    db_type = params['dbType']
    if db_type == 'mongodb':
        if mode == 'search':
            return f"""Given the schema: {schema_info}
            Generate a MongoDB query object to search for: "{user_query}".
            Use "find".
            Example: "find users over 25" becomes:
            ```json
            {{ "collection": "users", "operation": "find", "filter": {{ "age": {{ "$gt": 25 }} }} }}
            Return only the query object in a code block like that."""
            return f"""Given the schema: {schema_info}
            Generate a MongoDB query object to modify the database for: "{user_query}".
            Use "insertOne", "updateOne", or "deleteOne".
            Example: "add a user named John aged 30" becomes:
            {{ "collection": "users", "operation": "insertOne", "document": {{ "name": "John", "age": 30 }} }}
            Return only the query object in a code block like that."""
            if mode == 'search':
            return f"""Given the schema: {schema_info}
            Generate a SQL SELECT query (using standard ANSI SQL) to answer the user's question: "{user_query}"
            Return only the SQL query inside a code block like this:
            SELECT ...;
            No explanation, just the query."""
            return f"""Given the schema: {schema_info}
            Generate a SQL query (INSERT, UPDATE, or DELETE) to modify the database for: "{user_query}".
            Example: "add a user named John aged 30" becomes:
            INSERT INTO users (name, age) VALUES ('John', 30)
            Return only the query in a code block like that."""

def generate_explanation_prompt(params: dict) -> str:
    user_query = params['userQuery']
    results = params['results']
    if len(results) == 0:
        return f"User query: '{user_query}'. No data found. Respond with a natural language message indicating no information is available."
    return f"User query: '{user_query}'. Results: {json.dumps(results)}. Provide a concise natural language summary based only on these results."

# Load schema from file
async def load_schema():
    global schema_info
    try:
        with open('schema.txt', 'r') as f:
            schema_info = f.read()
            logger.info(f'Schema content: "{schema_info}"')
    except FileNotFoundError:
        logger.info('Schema file not found - starting without schema')
        schema_info = None
    except Exception as e:
        logger.error(f'Unexpected error loading schema.txt: {e}')
        raise

# Ensure schema is loaded
async def ensure_schema_loaded():
    global schema_info
    if not schema_info:
        logger.info('Schema not loaded - checking for schema.txt')
        try:
            with open('schema.txt', 'r') as f:
                schema_info = f.read()
                logger.info(f'Schema loaded: "{schema_info}"')
        except FileNotFoundError:
            raise Exception('No database uploaded yet - please upload a database first')
        except Exception as e:
            raise

class HuggingFaceAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = 'mistralai/Mixtral-8x7B-Instruct-v0.1'):
        self.api_key = api_key
        self.model = model
        self.endpoint = 'https://api-inference.huggingface.co/models'

    async def generate_query(self, schema_info: str, mode: str, user_query: str, db_type: str) -> Union[str, dict]:
        prompt = generate_query_prompt({'schemaInfo': schema_info, 'mode': mode, 'userQuery': user_query, 'dbType': db_type})
        url = f"{self.endpoint}/{self.model}"
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        payload = {'inputs': prompt, 'parameters': {'return_full_text': False}}
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        text = response.json()[0]['generated_text'] if isinstance(response.json(), list) else str(response.json())
        if db_type == 'mongodb':
            match = re.search(r'```json\n([\s\S]*?)\n```', text)
            return json.loads(match.group(1)) if match else text.strip()
        else:
            match = re.search(r'```sql\n([\s\S]*?)\n```', text)
            return match.group(1).strip() if match else text.strip()

    async def generate_explanation(self, user_query: str, results: List[Any]) -> str:
        prompt = generate_explanation_prompt({'userQuery': user_query, 'results': results})
        url = f"{self.endpoint}/{self.model}"
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        payload = {'inputs': prompt, 'parameters': {'return_full_text': False}}
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        text = response.json()[0]['generated_text'] if isinstance(response.json(), list) else str(response.json())
        return text

class NovitaAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = 'deepseek/deepseek-r1-turbo'):
        self.api_key = api_key
        self.model = model
        self.endpoint = 'https://router.huggingface.co/novita/v3/openai/chat/completions'

    async def generate_query(self, schema_info: str, mode: str, user_query: str, db_type: str) -> Union[str, dict]:
        prompt = generate_query_prompt({'schemaInfo': schema_info, 'mode': mode, 'userQuery': user_query, 'dbType': db_type})
        payload = {
            'messages': [{'role': 'user', 'content': prompt}],
            'model': self.model,
            'stream': False,
        }
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        response = requests.post(self.endpoint, headers=headers, json=payload)
        response.raise_for_status()
        text = response.json()['choices'][0]['message']['content']
        without_think = re.sub(r'<think>[\s\S]*?</think>', '', text).strip()
        if db_type == 'mongodb':
            match = re.search(r'```json\n([\s\S]*?)\n```', without_think)
            return json.loads(match.group(1)) if match else without_think
        else:
            match = re.search(r'```sql\n([\s\S]*?)\n```', without_think)
            return match.group(1).strip() if match else without_think

    async def generate_explanation(self, user_query: str, results: List[Any]) -> str:
        prompt = generate_explanation_prompt({'userQuery': user_query, 'results': results})
        payload = {
            'messages': [
                {'role': 'system', 'content': 'You are a concise summarizer. Output only the final natural-language summary—no reasoning steps, no <think> tags.'},
                {'role': 'user', 'content': prompt}
            ],
            'model': self.model,
            'stream': False,
        }
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        response = requests.post(self.endpoint, headers=headers, json=payload)
        response.raise_for_status()
        raw = response.json()['choices'][0]['message']['content']
        cleaned = re.sub(r'<think>[\s\S]*?</think>', '', raw).strip()
        return cleaned

# Database connection handling
async def reload_db():
    global db
    try:
        if db:
            db.close()
            logger.info('Existing database connection closed')
            db = None
        with open('db-config.txt', 'r') as f:
            config = json.load(f)
        
        if config['type'] == 'sqlite':
            db = sqlite3.connect(config['path'])
        elif config['type'] == 'mongodb':
            client = pymongo.MongoClient(config['url'])
            db = client[config['dbName']]
        elif config['type'] == 'mssql':
            db = pyodbc.connect(
                f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={config['server']};"
                f"DATABASE={config['database']};UID={config['user']};PWD={config['password']}"
            )
        
        logger.info(f'Connected to {config["type"]} database')
        with open('schema.txt', 'r') as f:
            schema_info = f.read()
            logger.info(f'Schema reloaded: "{schema_info}"')
        
        sql_cache.clear()
        result_cache.clear()
        logger.info('SQL and result caches cleared')
    except Exception as e:
        logger.error(f'Failed to reload database or schema: {e}')
        raise Exception('Failed to reload database or schema')

# Execute database query
async def execute_query(query: Union[str, dict], mode: str, db_type: str) -> List[Any]:
    cache_key = json.dumps(query)
    if cache_key in result_cache:
        return result_cache[cache_key]
    
    if not db:
        raise Exception('Database connection not initialized')
    
    if db_type == 'mongodb':
        if not isinstance(query, dict):
            raise Exception('MongoDB query must be an object')
        collection = db[query['collection']]
        if query['operation'] == 'find':
            rows = list(collection.find(query['filter']))
        elif query['operation'] == 'insertOne':
            rows = [collection.insert_one(query['document']).inserted_id]
        elif query['operation'] == 'updateOne':
            rows = [collection.update_one(query['filter'], {'$set': query['update']}).modified_count]
        elif query['operation'] == 'deleteOne':
            rows = [collection.delete_one(query['filter']).deleted_count]
        else:
            raise Exception(f'Unsupported MongoDB operation: {query["operation"]}')
    else:
        if not isinstance(query, str):
            raise Exception('SQL query must be a string')
        if mode == 'search' and not query.strip().upper().startswith('SELECT'):
            raise Exception('Only SELECT queries are allowed in Search Mode')
        cursor = db.cursor()
        cursor.execute(query)
        if db_type == 'sqlite':
            columns = [desc[0] for desc in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        elif db_type == 'mssql':
            columns = [column[0] for column in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        else:
            raise Exception('Unsupported SQL database type')
    
    result_cache[cache_key] = rows
    return rows

# AI Provider Factory (simplified)
class AIProvider:
    async def generate_query(self, schema_info: str, mode: str, user_query: str, db_type: str) -> Union[str, dict]:
        raise NotImplementedError
    
    async def generate_explanation(self, user_query: str, results: List[Any]) -> str:
        raise NotImplementedError

class GeminiAIProvider(AIProvider):
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model = 'gemini-1.5-flash'  # Default model name

    async def generate_query(self, schema_info: str, mode: str, user_query: str, db_type: str) -> Union[str, dict]:
        prompt = f"Schema: {schema_info}\nGenerate a {'MongoDB' if db_type == 'mongodb' else 'SQL'} query for: '{user_query}' in {mode} mode."
        response = await self.client.aio.models.generate_content(model=self.model, contents=prompt)
        text = response.text
        if db_type == 'mongodb':
            match = re.search(r'```json\n([\s\S]*?)\n```', text)
            return json.loads(match.group(1)) if match else text.strip()
        else:
            match = re.search(r'```sql\n([\s\S]*?)\n```', text)
            return match.group(1).strip() if match else text.strip()

    async def generate_explanation(self, user_query: str, results: List[Any]) -> str:
        prompt = f"User query: '{user_query}'. Results: {json.dumps(results)}. Summarize in natural language."
        response = await self.client.aio.models.generate_content(model=self.model, contents=prompt)
        return response.text

# MCP Server Setup
server = McpServer(name="Farming Database Server", version="1.0.0")

@server.tool(
    name="query_database",
    schema={
        "query": str,
        "aiProvider": str,
        "includeQuery": bool,
        "includeExplanation": bool,
        "includeResults": bool
    }
)
async def query_database(args: Dict[str, Any]) -> Dict[str, Any]:
    query, ai_provider_str, include_query, include_explanation, include_results = (
        args["query"], args["aiProvider"], args["includeQuery"], args["includeExplanation"], args["includeResults"]
    )
    
    await ensure_schema_loaded()
    try:
        await reload_db()
    except Exception as e:
        logger.error(f'Failed to reload database: {e}')
        return {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}
    
    with open('db-config.txt', 'r') as f:
        config = json.load(f)
    db_type = config['type']
    
    user_query = query.strip()
    mode = 'modify' if user_query.lower().startswith('modify:') else 'search'
    query_text = re.sub(r'^(search|modify):', '', user_query, flags=re.IGNORECASE).strip()
    
    # AI Provider Selection
    if ai_provider_str == 'gemini':
        ai_provider = GeminiAIProvider(os.getenv('GEMINI_API_KEY'))
    elif ai_provider_str.startswith('huggingface:'):
        model = ai_provider_str.split(':')[1]
        ai_provider = HuggingFaceAIProvider(os.getenv('HUGGINGFACE_API_KEY'), model)
    elif ai_provider_str.startswith('novita:'):
        model = ai_provider_str.split(':')[1]
        ai_provider = NovitaAIProvider(os.getenv('HUGGINGFACE_API_KEY'), model)
    else:
        raise Exception(f'Unsupported AI provider: {ai_provider_str}')
    
    logger.info(f'Using AI provider: {ai_provider_str}')
    
    try:
        generated_query = await ai_provider.generate_query(schema_info, mode, query_text, db_type)
        result = await execute_query(generated_query, mode, db_type) if include_results else None
        explanation = (
            await ai_provider.generate_explanation(query_text, result) if include_explanation and include_results
            else "Explanation not available without query results." if include_explanation else None
        )
        
        response = {}
        if include_query:
            response['query'] = generated_query
        if include_results:
            response['results'] = result
        if include_explanation:
            response['explanation'] = explanation
        
        return {"content": [{"type": "text", "text": json.dumps(response)}]}
    except Exception as e:
        return {"content": [{"type": "text", "text": f"Error: {e}"}], "isError": True}

# Start the server
async def main():
    await load_schema()
    transport = StdioServerTransport()
    await server.connect(transport)
    logger.info('MCP server running with StdioServerTransport')

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())