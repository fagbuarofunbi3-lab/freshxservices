// Direct client function builder replacing createServerFn.
// Calls the Go serverless backend directly without any proxy, server RPC, or middleman.

export function createFn(opts?: { method?: string }) {
  const chain = {
    validator: <TNewInput = any>(validator: (input: any) => TNewInput) => {
      return {
        handler: <TRes = any>(handler: (ctx: { data: TNewInput }) => Promise<TRes> | TRes) => {
          const fn = async (args?: { data?: any } | any): Promise<TRes> => {
            const rawData = args && typeof args === "object" && "data" in args ? args.data : args;
            const validated = validator ? validator(rawData) : rawData;
            return handler({ data: validated });
          };
          return fn;
        },
      };
    },
    inputValidator: <TNewInput = any>(validator: (input: any) => TNewInput) => {
      return chain.validator(validator);
    },
    handler: <TRes = any>(handler: (ctx: { data?: any }) => Promise<TRes> | TRes) => {
      const fn = async (args?: { data?: any } | any): Promise<TRes> => {
        const rawData = args && typeof args === "object" && "data" in args ? args.data : args;
        return handler({ data: rawData });
      };
      return fn;
    },
  };

  return chain;
}

export function useServerFn<T>(fn: T): T {
  return fn;
}

export const useClientFn = useServerFn;
