export function generateQueryPrompt(params: {
    schemaInfo: string;
    mode: string;
    userQuery: string;
    dbType: string;
}): string {
    const { schemaInfo, mode, userQuery, dbType } = params;
    if (dbType === 'mongodb') {
        if (mode === 'search') {
            return `Given the schema: ${schemaInfo}\nGenerate a MongoDB query object to search for: "${userQuery}".\nUse "find".\nExample: "find users over 25" becomes:\n\`\`\`json\n{ "collection": "users", "operation": "find", "filter": { "age": { "$gt": 25 } } }\n\`\`\`\nReturn only the query object in a code block like that.`;
        }
        return `Given the schema: ${schemaInfo}\nGenerate a Mongo更DB query object to modify the database for: "${userQuery}".\nUse "insertOne", "updateOne", or "deleteOne".\nExample: "add a user named John aged 30" becomes:\n\`\`\`json\n{ "collection": "users", "operation": "insertOne", "document": { "name": "John", "age": 30 } }\n\`\`\`\nReturn only the query object in a code block like that.`;
    }
    if (mode === 'search') {
        return `You are an expert SQL query generator. Given the following database schema:\n\n${schemaInfo}\n\nTables and columns:\n- manufacturers(id, name, location)\n- clothes(id, manufacturer_id, type, size, color, price)\n- stores(id, name, location)\n- customers(id, name, email, address)\n- sales(id, customer_id, clothing_id, store_id, sale_date, quantity)\n\nGenerate a SQL SELECT query (using standard ANSI SQL) to answer the user's question: "${userQuery}"\n\nInstructions:\n1. Identify which table and column(s) are needed. In this schema, "clothes.type" holds the clothing type (e.g., "pants", "shirts").\n2. If the user is asking for a count, use "COUNT(*)"\n3. Return only the SQL query inside a code block like this:\nSELECT ...;\n4. Do not include any explanation, comments, or extra text—only the SQL statement.\n\nExample:\n- If the user asks "How many pants are there?", your answer should be exactly:\nSELECT COUNT(*) AS total_pants\nFROM clothes\nWHERE type = 'pants';\n\nNow, generate the query for: "${userQuery}".`;
    }
    return `Given the schema: ${schemaInfo}\nGenerate a SQL query (INSERT, UPDATE, or DELETE) to modify the database for: "${userQuery}".\nExample: "add a user named John aged 30" becomes:\n\`\`\`sql\nINSERT INTO users (name, age) VALUES ('John', 30)\n\`\`\`\nReturn only the query in a code block like that.`;
}

export function generateExplanationPrompt(params: {
    userQuery: string;
    results: any[];
}): string {
    const { userQuery, results } = params;
    return results.length === 0
        ? `User query: '${userQuery}'. No data found. Respond with a natural language message indicating no information is available.`
        : `User query: '${userQuery}'. Results: ${JSON.stringify(results)}. Provide a concise natural language summary based only on these results.`;
}