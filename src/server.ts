import { type Express, type Request, type Response, type NextFunction } from 'express';

const api_version = 1
const least_supported_client_version = "0.2.1"

export type RPCRequest = {
    method: string;
    params: any[];
    version: number;
};


export type RPCResponse = {
    success: boolean;
    data?: any;
    error?: string;
};


export interface Metadata {
    auth: Record<string, string | number>;
    req?: Request,
    res?: Response,
}



export type RPCHandler = (
    auth_metadata: Metadata,
    ...params: any[]
) => any | Promise<any>;


export interface ValidatorReturn {
    success: boolean;
    metadata?: Metadata;
}

export type Validator = (req: Request) => ValidatorReturn;





export class RPC {


    private functions: Map<string, RPCHandler>;

    public validator: Validator = () => { return { success: true }; };

    constructor() {
        this.functions = new Map();
    }


    public async handler(requestData: RPCRequest, req: Request, res: Response): Promise<RPCResponse> {

        const methodName = requestData.method;
        const params = requestData.params;

        if (!methodName) {
            return {
                success: false,
                error: 'bad request: the request need to have "method" and "params"'
            };
        }

        if (typeof methodName !== 'string') {
            return {
                success: false,
                error: "bad request: RPC function doesn't exist"
            };
        }

        if (params && !Array.isArray(params)) {
            return {
                success: false,
                error: "bad request: RPC params should be a list"
            };
        }

        // obtaining RPC from lookup
        const functionHandler = this.functions.get(methodName);
        if (!functionHandler) {
            return {
                success: false,
                error: `RPC function '${methodName}' not found`
            };
        }

        // running auth validator
        const validation = this.validator(req);
        if (validation.success === false) {
            return {
                success: false,
                error: "Authentication failed"
            };
        }

        // passing requests to metadata
        const metadata = validation.metadata || { auth: {} };
        metadata.req = req;
        metadata.res = res;

        // RPC call
        try {
            const result = await functionHandler(metadata, ...(params || []));

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error(error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }

    }


    public dump(): string[] {
        return Array.from(this.functions.keys());
    }


    public add(functionHandler: RPCHandler, optional_name: string | null = null): void {
        let func_name;

        if (optional_name) {
            func_name = optional_name;
        } else {
            func_name = functionHandler.name;
        }

        if (!func_name) {
            throw new Error('Function must have a name');
        }
        this.functions.set(func_name, functionHandler);
    }


}



export function createRPC(app: Express, path: string, validator: Validator): RPC {
    const rpc = new RPC();
    rpc.validator = validator;

    app.post(`${path}/call`, async (req: Request, res: Response) => {

        try {
            const requestData: RPCRequest = req.body;

            if (!requestData || Object.keys(requestData).length === 0) {
                return res.status(400).json({ error: "Invalid JSON" });
            }

            if (requestData.version !== api_version) {
                return res.status(400).json({
                    error: `Invalid API version: make sure you are using the version of the client >= ${least_supported_client_version}`
                });
            }

            const result: RPCResponse = await rpc.handler(requestData, req, res);
            res.json(result);

        } catch (error) {
            res.status(500).json({ error: `Internal server error ${error}` });
        }

    });

    return rpc;
}

