import asyncio
import json
import sys
import logging

# Configure logging to write to a file
logging.basicConfig(filename='mcp-sdk.log', level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

class StdioServerTransport:
    """Handles communication for the MCP server via stdin/stdout."""
    async def run_server(self, server):
        try:
            logger.info("Starting StdioServerTransport run_server")
            reader = asyncio.StreamReader()
            protocol = asyncio.StreamReaderProtocol(reader)
            await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
            logger.info("Connected to stdin")
            while True:
                logger.info("Waiting for input...")
                line = await reader.readline()
                if not line:
                    logger.info("No more input, exiting server loop")
                    break
                logger.info(f"Received line: {line}")  # Added this
                message = json.loads(line.decode().strip())
                logger.info(f"Received message: {message}")
                if message['type'] == 'call_tool':
                    tool_name = message['name']
                    arguments = message['arguments']
                    if tool_name in server.tools:
                        tool = server.tools[tool_name]
                        if 'func' in tool:
                            result = await tool['func'](arguments)
                            logger.info(f"Tool {tool_name} result: {result}")
                            print(json.dumps(result))
                            sys.stdout.flush()
                        else:
                            logger.warning(f"Tool function not found for: {tool_name}")
                            print(json.dumps({'error': 'Tool function not found'}))
                            sys.stdout.flush()
                    else:
                        logger.warning(f"Tool not found: {tool_name}")
                        print(json.dumps({'error': 'Tool not found'}))
                        sys.stdout.flush()
                else:
                    logger.warning(f"Unknown message type: {message['type']}")
                    print(json.dumps({'error': 'Unknown message type'}))
                    sys.stdout.flush()
        except Exception as e:
            logger.error(f"Server error: {str(e)}")
            print(json.dumps({'error': f'Server error: {str(e)}'}))
            sys.stdout.flush()

class StdioClientTransport:
    """Handles communication with the MCP server via stdin/stdout."""
    def __init__(self, command, args):
        self.command = command
        self.args = args
        self.process = None

    async def connect(self):
        """Establishes a connection to the MCP server process."""
        logger.info(f"Connecting to MCP server with command: {self.command} {self.args}")
        self.process = await asyncio.create_subprocess_exec(
            self.command, *self.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        logger.info("Connection established")

        async def log_stderr():
            while True:
                line = await self.process.stderr.readline()
                if not line:
                    break
                logger.error(f"Server stderr: {line.decode().strip()}")
        asyncio.create_task(log_stderr())

    async def send(self, message):
        """Sends a message to the MCP server."""
        logger.info(f"Sending message: {message}")
        self.process.stdin.write((message + '\n').encode())
        await self.process.stdin.drain()

    async def receive(self):
        """Receives a response from the MCP server."""
        line = await self.process.stdout.readline()
        response = line.decode().strip()
        logger.info(f"Received response: {response}")
        return response

class Client:
    """MCP client that uses a transport to communicate with the server."""
    def __init__(self, name, version):
        self.name = name
        self.version = version
        self.transport = None

    async def connect(self, transport):
        """Connects the client to the specified transport."""
        logger.info(f"Client {self.name} (v{self.version}) connecting with transport")
        self.transport = transport
        await self.transport.connect()

    async def call_tool(self, name, arguments):
        """Calls a tool on the MCP server and returns the response."""
        logger.info(f"Calling tool: {name} with arguments: {arguments}")
        message = json.dumps({'type': 'call_tool', 'name': name, 'arguments': arguments})
        await self.transport.send(message)
        response = await self.transport.receive()
        logger.info(f"Raw response from server: '{response}'")
        if not response:
            logger.error("Empty response from MCP server")
            raise ValueError('Empty response from MCP server')
        return json.loads(response)

class McpServer:
    """Basic MCP server implementation."""
    def __init__(self, name, version):
        self.name = name
        self.version = version
        self.tools = {}
        logger.info(f"Initialized McpServer {self.name} (v{self.version})")

    def tool(self, name, schema):
        """Registers a tool with the server, including its schema."""
        def decorator(func):
            self.tools[name] = {'func': func, 'schema': schema}
            logger.info(f"Registered tool: {name}")
            return func
        return decorator

    async def run(self):
        logger.info("Starting McpServer run")
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
        while True:
            try:
                line = await reader.readline()
                if not line:
                    logger.info("No more input, exiting server loop")
                    break
                message = json.loads(line.decode().strip())
                logger.info(f"Received message: {message}")
                if message['type'] == 'call_tool':
                    tool_name = message['name']
                    arguments = message['arguments']
                    if tool_name in self.tools:
                        logger.info(f"Executing tool: {tool_name} with arguments: {arguments}")
                        result = await self.tools[tool_name](arguments)
                        logger.info(f"Tool {tool_name} result: {result}")
                        print(json.dumps(result))
                        sys.stdout.flush()
                    else:
                        logger.warning(f"Tool not found: {tool_name}")
                        print(json.dumps({'error': 'Tool not found'}))
                        sys.stdout.flush()
                else:
                    logger.warning(f"Unknown message type: {message['type']}")
                    print(json.dumps({'error': 'Unknown message type'}))
                    sys.stdout.flush()
            except Exception as e:
                logger.error(f"Server error: {str(e)}")
                print(json.dumps({'error': f'Server error: {str(e)}'}))
                sys.stdout.flush()