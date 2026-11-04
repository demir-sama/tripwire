export { RPC, SANDBOX_CREATOR, SANDBOX_SYMBOL, tokenAccount } from "./config";
import { toYocto } from "./format";
export const toString = (n: string) => BigInt(toYocto(n));
