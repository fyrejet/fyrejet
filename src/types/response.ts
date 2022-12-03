import type {  ServerResponse } from "http"
import type { FyrejetApp, FyrejetDataStorage, FyrejetRequest, Nullable, SingleOrArray } from "."

import type {CookieOptions} from 'express-serve-static-core'
export type FyrejetResponseUninitialized = (ServerResponse) & {
	defaultErrHandler: (err?: unknown) => void,
	app: FyrejetApp
}

type Send<Body = string> = (body: Body, args?: Body[]) => FyrejetResponse

export type FyrejetResponse<
	StatusCode extends number = number
> = FyrejetResponseUninitialized & {

	req: FyrejetRequest,
	locals: FyrejetDataStorage<unknown>,
	body?: unknown,
	

	get: (field: string) => string | number | string[] | undefined,

	set: (field: string, val: unknown) => FyrejetResponse,
	header: (field: string, val: unknown) => FyrejetResponse,

	links: (links: Record<string, string>) => FyrejetResponse,

	send: Send<unknown>,
	json: Send<unknown>,
	jsonp: Send<unknown>

	status: (code: StatusCode) => FyrejetResponse,
	sendStatus(code: StatusCode): FyrejetResponse;

	contentType: (contentType: string) => FyrejetResponse,
	type: (contentType: string) => FyrejetResponse,

	format: (obj: any) => FyrejetResponse,
	vary: (field: string) => FyrejetResponse;

	sendLite: (
		data?: unknown,
		code?: number,
		headers?: Nullable<Record<string, number | string | string[]>>,
		cb?: () => void
	) => void,

	attachment: (filename: string) => FyrejetResponse,
	append: (field: string, value: SingleOrArray<string|number>) => FyrejetResponse,

	location: (path: string) => FyrejetResponse,
	redirect: (url: string, arg2: string | number) => FyrejetResponse,

	cookie: (name: string, value: string, options?: CookieOptions) => FyrejetResponse,
	clearCookie: (name: string, options?: CookieOptions) => FyrejetResponse
}

export {
	CookieOptions
}