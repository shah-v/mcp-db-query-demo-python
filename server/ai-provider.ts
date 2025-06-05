export interface AIProvider {
    generateQuery(params: {
        schemaInfo: string;
        mode: string;
        userQuery: string;
        dbType: string;
    }): Promise<string | object>;
    generateExplanation(params: {
        userQuery: string;
        results: any[];
    }): Promise<string>;
}