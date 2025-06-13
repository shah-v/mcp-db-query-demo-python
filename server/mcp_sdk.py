import asyncio
import json

class StdioClientTransport:
    """Handles communication with the MCP server via stdin/stdout."""
    def __init__(self, command, args):
        self.command = command
        self.args = args
        self.process = None

    async def connect(self):
        """Establishes a connection to the MCP server process."""
        self.process = await asyncio.create_subprocess_exec(
            self.command, *self.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

    async def send(self, message):
        """Sends a message to the MCP server."""
        self.process.stdin.write((message + '\n').encode())
        await self.process.stdin.drain()

    async def receive(self):
        """Receives a response from the MCP server."""
        line = await self.process.stdout.readline()
        return line.decode().strip()

class Client:
    """MCP client that uses a transport to communicate with the server."""
    def __init__(self, name, version):
        self.name = name
        self.version = version
        self.transport = None

    async def connect(self, transport):
        """Connects the client to the specified transport."""
        self.transport = transport
        await self.transport.connect()

    async def call_tool(self, name, arguments):
        """Calls a tool on the MCP server and returns the response."""
        message = json.dumps({'type': 'call_tool', 'name': name, 'arguments': arguments})
        await self.transport.send(message)
        response = await self.transport.receive()
        return json.loads(response)


class McpServer:
    """Basic MCP server implementation."""
    def __init__(self, name, version):
        self.name = name
        self.version = version
        self.tools = {}

    def tool(self, name, schema, func):
        """Registers a tool with the server."""
        self.tools[name] = func

    async def run(self):
        """Runs the server, reading from stdin and writing to stdout."""
        while True:
            line = await asyncio.to_thread(input)  # Simplified; use sys.stdin in practice
            if not line:
                break
            message = json.loads(line.strip())
            if message['type'] == 'call_tool':
                tool_name = message['name']
                arguments = message['arguments']
                if tool_name in self.tools:
                    result = await self.tools[tool_name](arguments)
                    print(json.dumps(result))
                else:
                    print(json.dumps({'error': 'Tool not found'}))