import { type IncomingMessage } from "http"
import RangeParser from "range-parser";
import { FyrejetApp, FyrejetResponse, NextFunction, Params } from ".";
import {Nullable} from './utils'

import { Route } from "../routing/trouter";
import { RequestQuery } from "../routing/types";

export interface RequestHeader {
	(name: 'set-cookie'): string[] | undefined;
	(name: string): string | string[] | undefined;
}

export interface RequestAccepts {
	(): string[];
    (...type: string[]): string | false;
}

export interface RequestAcceptsCharsets {
	(): string[];
	(...charsets: string[]): string | false;
}

export interface RequestAcceptsEncodings {
	(): string[];
    (...encodings: string[]): string | false;
}

export interface RequestAcceptsLanguages {
	(): string[];
	(...lang: string[]): string | false;
}

export interface FyrejetRequestUnitialized extends IncomingMessage  {
	res: FyrejetResponse,
	app: FyrejetApp,
	params: Params,
}

export type FyrejetRequest = FyrejetRequestUnitialized & {
	originalUrl: string,
	rData_internal: {
		urlPrev: string,
		methodPrev: string,
		appPrev: FyrejetApp[],
		urlPrevious: string[],
		noEtag?: boolean,
		urlProperVerified?: string,
		initDone?: boolean,
		lastPattern?: string | RegExp,
		paramsPrev?: Params[],
		encodingSet?: boolean,
		currentRouteMiddlewareNum?: number
	},
	route: Route,
	routesToProcess: Route[],
	next: NextFunction,
	stepString?: string,
	paramsCalled: Record<string|number, string>,
	paramsUserDefined?: string[]
	


	path: string,
	search: string,
	query: RequestQuery,
	body: Record<string, unknown>,

	activateExpress: () => FyrejetRequest,

	get: RequestHeader,
	header: RequestHeader,

	accepts: RequestAccepts,
	acceptsCharsets: RequestAcceptsCharsets;
	acceptsEncodings: RequestAcceptsEncodings;
	acceptsLanguages: RequestAcceptsLanguages;

	range: (size: number, options?: RangeParser.Options) => RangeParser.Ranges | RangeParser.Result | undefined;
	param: <T=string>(name: string, defaultValue?: any) => T;

	is: (...types: string[]) => string | false | null;

	subdomains: () => string[];

	protocol: () => string;
	secure: () => boolean;
	ip: () => string;
	ips: () => string[];

	hostname: () => Nullable<string>;

	setUrl: (url: string) => FyrejetRequest;
	setMethod: (method: string) => FyrejetRequest;

	fresh: () => boolean;
	stale: () => boolean;

	baseUrl: () => string;
	currentUrl: () => string;

	xhr: () => boolean;
}