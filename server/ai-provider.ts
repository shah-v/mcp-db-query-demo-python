export interface AIProvider {
    generateQuery(schemaInfo: string, mode: string, userQuery: string, dbType: string): Promise<string | object>;
    generateExplanation(userQuery: string, results: any[]): Promise<string>;
}