import { type Express, type Request, type Response, type NextFunction } from 'express';
import * as cookie from 'cookie';

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
    code:number;
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





export class RPCError {

    error_label: string;
    error_params: Record<string, string> = {};
    status_code: number;

    constructor(status_code: number, error_label: string, params: Record<string, string> = {} ) {
        this.error_label = error_label;
        this.error_params = params;
        this.status_code = status_code;
    }

}





type RPCErrorHandler = (params: Record<string, string>) => string;





export class RPC {

    private error_handlers_registry: Map<string, RPCErrorHandler> = new Map();
    private functions: Map<string, RPCHandler>;

    public validator: Validator = () => { return { success: true }; };

    constructor() {
        this.functions = new Map();
    }

    // users fire RPC errors and give them labels and params
    public async handleError( label:string , error_handler:RPCErrorHandler ) {
        this.error_handlers_registry.set(label, error_handler);
    }

    public async handler(requestData: RPCRequest, req: Request, res: Response): Promise<RPCResponse> {

        const methodName = requestData.method;
        const params = requestData.params;

        if (!methodName) {
            return {
                success: false,
                code: 400,
                error: 'bad request: the request need to have "method" and "params"'
            };
        }

        if (typeof methodName !== 'string') {
            return {
                success: false,
                code: 404,
                error: "bad request: RPC function doesn't exist"
            };
        }

        if (params && !Array.isArray(params)) {
            return {
                success: false,
                error: "bad request: RPC params should be a list",
                code: 400
            };
        }

        // obtaining RPC method from lookup
        const functionHandler = this.functions.get(methodName);
        if (!functionHandler) {
            return {
                success: false,
                error: `RPC function '${methodName}' not found`,
                code: 400
            };
        }

        // running auth validator that is specified by the user
        const validation = this.validator(req);
        if (validation.success === false) {
            return {
                success: false,
                error: "authorization failed",
                code: 403
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
                data: result,
                code: 200
            };

        } catch (error) {
            if (error instanceof RPCError) {
                
                const error_handler = this.error_handlers_registry.get(error.error_label);
                if ( !error_handler ) {
                    console.error(`unhandled exception for label "${error.error_label}"`);

                    return {
                        success: false,
                        error: "Error 500: operation failed",
                        code: 500
                    };
                }
                const error_msg = error_handler( error.error_params );

                return {
                    success: false,
                    error: error_msg,
                    code: error.status_code
                };

            } else {
                console.error(error);
                
                return {
                    success: false,
                    error: "Error 500: operation failed",
                    code: 500
                };
            }
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





export function cookieParser(req: Request, _res: Response, next: NextFunction) {
    const raw_cookies = req.headers.cookie;
    if (!raw_cookies) {
        next()
        return;
    }

    req.cookies = cookie.parse(raw_cookies) || {};

    next();
}





export function createRPC( app:Express , path:string , validator:Validator ) : RPC {
    const rpc = new RPC();
    rpc.validator = validator;

    if ( !app.get("enders-sync-dependencies-loaded") ){
        app.use( cookieParser );
        app.set("enders-sync-dependencies-loaded" , true);
    }

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
            res.status(result.code).json(result);

        } catch (error) {
            res.status(500).json({ error: `Internal server error 500` });
        }

    });

    return rpc;
}

