MCP Demo
================

Welcome to the **MCP Demo**! This project is a powerful demonstration of how natural language processing and database integration can simplify access to data. By leveraging the **Model Context Protocol (MCP)** and the **Gemini API**, it allows users to query data using plain English through a web interface or command-line tools. The system supports multiple database backends---SQLite, MSSQL, and MongoDB---making it versatile for various use cases.

Purpose
-------

The **MCP Demo** aims to:

-   Provide a **user-friendly interface** for querying farming data without requiring SQL or database expertise.
-   Showcase the integration of AI-driven query generation (via Gemini API) with a flexible database abstraction layer.
-   Demonstrate how MCP can bridge client-server communication to process natural language queries.
-   Serve as a template for building scalable, multi-database applications with real-world applications in agriculture.

This project is ideal for developers, researchers, or anyone interested in exploring how AI can make complex data accessible.

Features
--------

-   **Multi-Database Support**: Works with SQLite, MSSQL, and MongoDB, allowing flexibility in data storage.
-   **Natural Language Queries**: Ask questions like "How many farms are there?" or "List crops in Green Acres" and get results from the database.
-   **Web Interface**: A sleek, interactive frontend built with React and Tailwind CSS for easy database uploads and querying.
-   **CLI Tools**: Command-line options for testing and interactive querying.
-   **AI-Powered**: Uses the Gemini API to translate plain English into database queries (SQL or MongoDB operations).
-   **Caching**: Optimizes performance with query and result caching.
-   **Extensible Design**: Database abstraction layer and registry make it easy to add new database types.

Requirements
------------

To run this project, you'll need:

-   **Node.js**: Version 18 or higher ([download here](https://nodejs.org/)).
-   **Databases**: At least one of the following:
    -   SQLite (no additional setup for local files).
    -   MSSQL (requires a running server instance).
    -   MongoDB (requires a running server, e.g., locally at mongodb://localhost:27017).
-   **Gemini API Key**: Obtain one from [Google AI Studio](https://aistudio.google.com/) for AI query generation.
-   A terminal or command-line interface.

Installation
------------

Follow these steps to set up the project locally:

1.  **Clone the Repository**

    `git clone https://github.com/yourusername/mcp-farming-demo.git cd mcp-farming-demo`

2.  **Install Dependencies**

    `npm install`

    This installs all required packages, including Express, MongoDB, MSSQL, SQLite3, and the MCP SDK.
3.  **Configure Environment Variables**
    -   Create a .env file in the project root:

        `GEMINI_API_KEY=your-actual-key-here`

    -   Replace your-actual-key-here with your Gemini API key from Google AI Studio.
    -   Ensure .env is listed in .gitignore to keep your key secure.
4.  **Prepare a Database (Optional)**
    -   **SQLite**: Use the provided setup/setup-db.ts script to create a sample farming.db:

        `npx ts-node setup/setup-db.ts`

    -   **MSSQL**: Run setup/setup-db-mssql.ts after updating the config with your server details.
    -   **MongoDB**: Run setup/setup-db-mongodb.ts to populate a local MongoDB instance.
    -   Alternatively, use your own database and upload it via the web interface.

Usage
-----

### Option 1: Web Interface

1.  **Start the Servers**
    -   In one terminal, start the API server:

        `npx ts-node server/server.ts`

    -   In another terminal, start the web server:

        `npx ts-node server/app.ts`

2.  **Access the Interface**
    -   Open your browser to http://localhost:3000.
    -   Select a database type (SQLite, MSSQL, or MongoDB).
    -   For SQLite, upload a .db or .sqlite file; for MSSQL/MongoDB, enter connection details.
    -   Click "Load Database" to initialize the system.
3.  **Query the Database**
    -   Choose a mode: "Search Mode" (read-only) or "Modify Mode" (future write support).
    -   Type a question (e.g., "How many farms are there?") and click "Ask".
    -   View the generated query, results, and explanation in the interface.

### Option 2: Command-Line Interface (CLI)

1.  **Start the MCP Server**

    `npx ts-node server/mcp-server.ts`

2.  **Run the CLI**

    `npx ts-node client/cli.ts`

    -   Enter queries like "list all farms" or type "exit" to quit.
    -   Requires a pre-loaded database via the web interface or manual setup.

### Option 3: Test Client

1.  **Start the MCP Server**

    `npx ts-node server/mcp-server.ts`

2.  **Run Test Queries**

    `npx ts-node client/client.ts`

    -   Executes predefined test queries (e.g., "crops in Green Acres").

### Example Queries

-   **Search Mode**:
    -   "How many farms are there?"
    -   "List all crops in Green Acres"
    -   "Which farms grow wheat?"
-   **Output**: Results include the generated query (SQL/MongoDB), data rows, and a natural language explanation.

Project Structure
-----------------

-   **database/**: Database abstraction layer and implementations (MongoDB, MSSQL, SQLite).
-   **server/**: Backend servers (app.ts for web, mcp-server.ts for MCP, server.ts for API).
-   **client/**: CLI (cli.ts) and test client (client.ts).
-   **static/**: Web frontend (index.html with React).
-   **setup/**: Scripts to create sample databases.

License
-------

This project is licensed under the MIT License.