# MCP Demo

Welcome to the **MCP Demo**! This project demonstrates how the **Model Context Protocol (MCP)** integrates AI with databases to enable natural language querying. By leveraging AI providers like Gemini, Hugging Face, or Novita, it translates plain English questions into database queries, making data access intuitive and efficient. The system supports multiple databases (SQLite, MSSQL, MongoDB) and offers both a web interface and command-line tools for interaction.

## Purpose

The **MCP Demo** aims to:
- Provide a **user-friendly interface** for querying databases without needing SQL or database expertise.
- Showcase how MCP facilitates client-server communication to process natural language queries using AI.
- Demonstrate the integration of AI-driven query generation with a flexible database abstraction layer.
- Serve as a template for building scalable, multi-database applications, with a focus on simplifying data access in domains like agriculture.

This project is ideal for developers, researchers, or anyone interested in exploring how AI can make complex data accessible.

## Features

- **Multi-Database Support**: Compatible with SQLite, MSSQL, and MongoDB.
- **Natural Language Queries**: Ask questions like "How many farms are there?" or "List crops in Green Acres" to retrieve data.
- **Web Interface**: A React-based frontend for uploading databases, selecting AI providers, and toggling query components (generated query, results, explanation).
- **CLI Tools**: Command-line options for testing and interactive querying.
- **AI-Powered Query Generation**: Uses AI providers (Gemini, Hugging Face, Novita) to translate natural language into SQL or MongoDB queries.
- **Caching**: Optimizes performance with query and result caching.
- **Extensible Design**: Easily add new database types or AI providers via the registry and factory patterns.

## Requirements

To run this project, you'll need:
- **Node.js**: Version 18 or higher ([download here](https://nodejs.org/)).
- **Databases**: At least one of the following:
  - SQLite (no additional setup for local files).
  - MSSQL (requires a running server instance).
  - MongoDB (requires a running server, e.g., locally at \`mongodb://localhost:27017\`).
- **API Keys**: Obtain API keys for the AI providers you wish to use:
  - Gemini API Key from [Google AI Studio](https://aistudio.google.com/).
  - Hugging Face API Key from [Hugging Face](https://huggingface.co/).
  - Novita API Key (if using Novita models; can reuse Hugging Face key for this demo).
- A terminal or command-line interface.

## Installation

Follow these steps to set up the project locally:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/MCP-Learning/mcp-db-query-demo.git
   cd mcp-db-query-demo
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Create a \`.env\` file in the project root based on \`.env.example\`:
     ```env
     AI_PROVIDER=gemini
     GEMINI_API_KEY=your_gemini_api_key_here
     HUGGINGFACE_API_KEY=your_huggingface_api_key_here
     ```
   - Replace placeholders with your actual API keys.
   - Ensure \`.env\` is listed in \`.gitignore\` to keep your keys secure.

4. **Prepare a Database (Optional)**
   - **SQLite**: Use \`setup/setup-db.ts\` to create a sample \`farming.db\`:
     ```bash
     npx ts-node setup/setup-db.ts
     ```
   - **MSSQL**: Run \`setup/setup-db-mssql.ts\` after updating the config with your server details.
   - **MongoDB**: Run \`setup/setup-db-mongodb.ts\` to populate a local MongoDB instance.
   - Alternatively, use your own database and upload it via the web interface.

## Usage

### Option 1: Web Interface

1. **Start the Servers**
   - In one terminal, start the API server:
     ```bash
     npx ts-node server/server.ts
     ```
   - In another terminal, start the web server:
     ```bash
     npx ts-node server/app.ts
     ```

2. **Access the Interface**
   - Open your browser to \`http://localhost:3000\`.
   - Select a database type (SQLite, MSSQL, or MongoDB).
   - For SQLite, upload a \`.db\` or \`.sqlite\` file; for MSSQL/MongoDB, enter connection details.
   - Click "Load Database" to initialize the system.

3. **Query the Database**
   - Choose a mode: "Search Mode" (read-only) or "Modify Mode" (future write support).
   - Select an AI provider (e.g., Gemini, Hugging Face: Mistral, Novita: DeepSeek).
   - Toggle options to include the generated query, results, and explanation.
   - Type a question (e.g., "How many farms are there?") and click "Ask".
   - View the response in the interface.

### Option 2: Command-Line Interface (CLI)

1. **Start the MCP Server**
   ```bash
   npx ts-node server/mcp-server.ts
   ```

2. **Run the CLI**
   ```bash
   npx ts-node client/cli.ts
   ```
   - Enter queries like "list all farms" or type "exit" to quit.
   - Requires a pre-loaded database via the web interface or manual setup.

### Option 3: Test Client

1. **Start the MCP Server**
   ```bash
   npx ts-node server/mcp-server.ts
   ```

2. **Run Test Queries**
   ```bash
   npx ts-node client/client.ts
   ```
   - Executes predefined test queries (e.g., "crops in Green Acres").

### Example Queries

- **Search Mode**:
  - "How many farms are there?"
  - "List all crops in Green Acres"
  - "Which farms grow wheat?"
- **Output**: Depending on the toggles, the response may include the generated query (SQL/MongoDB), data rows, and a natural language explanation.

## How MCP Facilitates AI and Database Integration

The **Model Context Protocol (MCP)** is central to this project, enabling seamless integration of AI with databases:

- **Client-Server Communication**: MCP bridges the client (web interface or CLI) and server, allowing natural language queries to be sent, processed by AI, and returned as structured responses. This is implemented via the MCP SDK in \`client/cli.ts\`, \`client/client.ts\`, and \`server/mcp-server.ts\`.
- **Tool-Based Architecture**: The \`query_database\` tool in \`mcp-server.ts\` encapsulates the logic for AI-driven query generation, database execution, and result explanation. This modular design makes it easy to extend or modify functionality.
- **AI Integration**: MCP integrates with multiple AI providers (Gemini, Hugging Face, Novita) through a factory pattern (\`ai-provider-factory.ts\`), abstracting the complexity of model interactions. The AI translates user queries into executable database commands, as seen in \`gemini-ai-provider.ts\`, \`huggingface-ai-provider.ts\`, and \`novita-ai-provider.ts\`.
- **Database Abstraction**: MCP supports multiple database types (SQLite, MSSQL, MongoDB) via a registry and factory pattern (\`database-registry.ts\`, \`database.ts\`). This flexibility ensures the system can adapt to various data sources without altering the core logic.

By combining these elements, MCP simplifies the process of using AI to query databases, making it accessible to non-technical users while remaining extensible for developers.

## Project Structure

- **database/**: Database abstraction layer and implementations (MongoDB, MSSQL, SQLite).
- **server/**: Backend servers (\`app.ts\` for web, \`mcp-server.ts\` for MCP, \`server.ts\` for API).
- **client/**: CLI (\`cli.ts\`) and test client (\`client.ts\`).
- **static/**: Web frontend (\`index.html\` with React).
- **setup/**: Scripts to create sample databases.
- **.env.example**: Template for environment variables.

## License

This project is licensed under the MIT License.