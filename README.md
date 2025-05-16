Farming Database Query System
=============================

Welcome to the **Farming Database Query System**! This project demonstrates an innovative way to query a farming database using everyday language. By combining the **Model Context Protocol (MCP)** and the **Gemini API**, it translates natural language questions into SQL commands, allowing users to get answers about farms, crops, and harvests without needing technical expertise.

What's This Project About?
--------------------------

Imagine you're a farmer, a researcher, or just someone curious about agricultural data. Normally, you'd need to know SQL or have a tech expert help you dig into a database. This project changes that! It's a demo of how artificial intelligence can make complex data accessible to everyone. Using AI, we've built a system where you can ask simple questions like "how many farms are there?" or "what crops grow at Green Acres?" and get clear, accurate answers pulled straight from a database.

### What Are We Trying to Achieve?

Our goal is to create a **user-friendly interface** that:

-   Lets anyone ask questions about farming data in plain English.
-   Uses AI to understand those questions and fetch the right answers from a database.
-   Shows how powerful tools like MCP and the Gemini API can simplify data access.
-   Bridges the gap between technical systems and everyday users, making farming data more approachable.

In short, we're proving that you don't need to be a database wizard to explore agricultural insights---just type your question, and let the AI do the heavy lifting!

Requirements
------------

Before you can run the project, make sure you have the following:

-   **Node.js**: Version 18 or higher (download- **SQLite**: For managing the farming database.
-   A **Gemini API Key**: You'll need this to power the AI query system. Sign up at [Google AI Studio](https://aistudio.google.com/) to get one.
-   A terminal or command-line tool to run the scripts.

How to Set It Up and Run It: Step-by-Step
-----------------------------------------

Follow these steps to get the project up and running on your machine. Don't worry---we'll walk you through every detail!

### Step 1: Get the Project Files

1.  Open your terminal.
2.  Download the project by cloning the repository:

    ```
    git clone https://github.com/yourusername/mcp-farming-demo.git

    ```

3.  Move into the project folder:

    ```
    cd mcp-farming-demo

    ```

### Step 2: Install Dependencies

1.  Run this command to install all the necessary packages:

    ```
    npm install

    ```

    This sets up everything the project needs to work, like the tools to talk to the Gemini API and handle the database.

### Step 3: Set Up the Database

1.  Create a SQLite database called `farming.db`.
2.  Add these tables to it:
    -   **`farms`**: Columns: `id` (integer), `name` (text), `location` (text)
    -   **`crops`**: Columns: `id` (integer), `farm_id` (integer), `type` (text), `planting_date` (text)
    -   **`harvests`**: Columns: `id` (integer), `crop_id` (integer), `harvest_date` (text), `quantity` (real)
3.  Add some sample data to play with. Here's an example you can run in your SQLite tool:

    ```
    INSERT INTO farms (name, location) VALUES ('Green Acres', 'California'), ('Sunny Fields', 'Texas');
    INSERT INTO crops (farm_id, type, planting_date) VALUES (1, 'wheat', '2025-03-01'), (2, 'corn', '2025-04-01');
    INSERT INTO harvests (crop_id, harvest_date, quantity) VALUES (1, '2025-07-01', 10.5), (2, '2025-08-15', 15.0);

    ```

### Step 4: Add Your Gemini API Key

1.  Create a file named `.env` in the root directory of the project (the same folder where `server.ts` and `package.json` are located).
2.  Add the following line to the `.env` file:

    ```
    GEMINI_API_KEY="your-actual-key-here"
    ``` 
    Replace `your-actual-key-here` with the actual API key you got from Google AI Studio.
3. Save the `.env` file.

**Important:** Make sure the `.env` file is not committed to version control (e.g., Git) by adding it to your `.gitignore` file.

### Step 5: Run the Project

Now you're ready to see it in action!

#### Option 1: Start the Server and Test with Predefined Queries

1.  In one terminal, start the MCP server:

    ```
    npx ts-node server.ts

    ```

    This powers up the system and gets it ready to handle queries.
2.  In a second terminal, run the client script to see some example questions in action:

    ```
    npx ts-node client.ts

    ```

#### Option 2: Use the Interactive CLI

1.  Start the server (same as above):

    ```
    npx ts-node server.ts

    ```

2.  In another terminal, launch the interactive command-line interface:

    ```
    npx ts-node cli.ts

    ```

3.  Type your own questions---like "list all farms" or "crops in Sunny Fields"---and watch it respond!

Example Questions to Try
------------------------

Here's a taste of what you can ask:

-   "how many farms"
-   "list all farms"
-   "crops in Green Acres"
-   "tell me about Sunny Fields"
-   "which farms grow wheat"

### What You'll See

-   For "how many farms":

    ```
    [{"NumberOfFarms":2}]

    ```

-   For "crops in Green Acres":

    ```
    [{"id":1,"farm_id":1,"type":"wheat","planting_date":"2025-03-01"}]

    ```

-   For something unrelated like "what's the weather?":

    ```
    I can only answer questions about farms, crops, and harvests.

    ```

Extra Notes
-----------

-   **API Key**: Make sure your Gemini API key is valid and has enough usage quota. If it's rate-limited, you might see delays or errors.
-   **Error Handling**: If something goes wrong (like a badly worded question), the system will let you know and suggest trying again.
-   **What It Can't Do**: It's focused on farm-related data only---so no weather forecasts or unrelated topics!

Why This Matters
----------------

This project is a proof-of-concept for how AI can transform the way we interact with data. Whether you're a developer, a farmer, or just a curious mind, it's a fun and practical way to explore the future of technology in agriculture.

Happy querying!