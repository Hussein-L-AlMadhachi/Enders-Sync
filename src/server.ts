import { type Express , type Request , type Response, type NextFunction } from 'express';



export type RPCRequest = {
    method: string;
    params: any[];
};


export type RPCResponse = {
    success: boolean;
    data?: any;
    error?: string;
};


export type AuthMetadata = Record<string, string | number>;


export type RPCHandler = (
  auth_metadata: AuthMetadata,
  ...params: any[]
) => any | Promise<any>;


export interface ValidatorReturn {
    success: boolean;
    metadata?: AuthMetadata;
}
export type Validator = (cookie:string)=>ValidatorReturn;


export class RPC {
    private functions: Map<string, RPCHandler>;

    public validator: Validator = ()=>{  return { success:true , metadata:{} };  };

    constructor() {
        this.functions = new Map();
    }

    public handler(requestData: RPCRequest , cookie:string): RPCResponse {
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

        // RPC call
        const functionHandler = this.functions.get(methodName);
        if (!functionHandler) {
            return {
                success: false,
                error: `RPC function '${methodName}' not found`
            };
        }

        const validation = this.validator( cookie );
        if ( validation.success === false ){
            return {
                success: false,
                error: "Authentication failed"
            };
        }
        
        try {
            const result = functionHandler( validation.metadata! , ...(params || []));

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

    public add(functionHandler: RPCHandler): void {
        const funcName = functionHandler.name;
        if (!funcName) {
            throw new Error('Function must have a name');
        }
        this.functions.set(funcName, functionHandler);
    }
}



export function cookieParser(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers.cookie;
    req.cookies = header
        ? Object.fromEntries(
            header.split(";").map( (v:string) => {
                const [k, ...rest] = v.split("=");
                return [k!.trim(), decodeURIComponent(rest.join("="))];
            })
        )
        : {};

    next();
}





export function useExpressRPC( app:Express , path:string , validator:Validator , cookie_key:string="token" ) : RPC {
    const rpc = new RPC();
    rpc.validator = validator;

    if ( !app.get("cookie-parser") ){
        app.use( cookieParser );
        app.set("cookie-parser" , true);
    }

    app.get(`${path}/discover`, (req: Request, res: Response) => {

        try {
            const rpcList = rpc.dump();
            res.json(rpcList);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }

    });

    app.post(`${path}/call`, (req: Request, res: Response) => {

        try {
            const requestData: RPCRequest = req.body;
            
            if (!requestData || Object.keys(requestData).length === 0) {
                return res.status(400).json({ error: "Invalid JSON" });
            }
            
            const authToken = req.cookies[cookie_key] || '';

            const result: RPCResponse = rpc.handler(requestData , authToken);
            res.json(result);

        } catch (error) {
            res.status(500).json({ error: `Internal server error ${error}` });
        }

    });

    return rpc;
}

