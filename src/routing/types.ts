import { FyrejetDataStorage, FyrejetRequest, FyrejetResponse, Middleware } from "../types";

export type FinalRoute = (req: FyrejetRequest, res: FyrejetResponse) => void
export type ErrorHandler = (err: Error | unknown, req: FyrejetRequest, res: FyrejetResponse) => void

type SequentialConfigBase = {
	mountpath?: string;
	routerCacheSize?: number;
	cacheSize?: number;
	defaultRoute?: FinalRoute;
	sensitive?: boolean;
	caseSensitive?: boolean;
	errorHandler?: ErrorHandler;
	id?: string | number;
}

export type SequentialConfig = SequentialConfigBase & Record<string,unknown>

export type MountedRouters = Record<string,Middleware>

export type RequestQuery = FyrejetDataStorage<unknown>

export type QueryParser = (query: string) => RequestQuery

export type ChangeSequentialConfig = (option: string, value: unknown) => void;

export type GetSequentialConfig = () => SequentialConfig