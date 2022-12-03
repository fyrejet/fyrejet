import EventEmitter from "events";
import { Match, Route } from "../routing/trouter";

import type { HttpMethod } from "./httpMethod";
import type { FyrejetRequest } from "./request";
import { FyrejetResponse } from "./response";
export {HttpMethod}

import { Nullable, FyrejetDataStorage } from "./utils";
export * from './utils';
export * from './request'
export * from './response'


export interface NextFunction {
    (err?: any): void;
    (deferToNext: 'router'): void;
    (deferToNext: 'route'): void;
}

export type Middleware = ((req: FyrejetRequest, res: FyrejetResponse, next: NextFunction) => void) & {
	id?: string|number;
	init?: boolean;
}

export type Params = {
	[k: string]: unknown;
}

type RouteFormerMethods = {
	[k in HttpMethod]?: (fn: Middleware) => void;
}

export type RouteFormer = RouteFormerMethods

export type RenderFunction = (...args: any[]) => any

type FyrejetAppLocalsSettings = {
	settings?: FyrejetDataStorage<unknown>;
}

export type FyrejetAppLocals = FyrejetAppLocalsSettings & {
	[k: string]: unknown
}

export type ParamFn = (req: FyrejetRequest, res: FyrejetResponse, next?: NextFunction, param?: string) => void

export type PoweredByFn = (res: FyrejetResponse) => void

export interface AppSetFn {
	(settingA: string): unknown;
	(settingB: string, val: unknown): FyrejetApp;
}

export type GetSetting = (setting: string) => unknown;

export interface GetFn {
	(setting: string): unknown;
	(url: string, ...args: Middleware[]): FyrejetApp;
}

export type RenderCallback = (err: Error, html: string) => void

type RenderSuppliedOptionsLocals = {
	_locals?: FyrejetDataStorage<unknown>
}

export type RenderSuppliedOptions = RenderSuppliedOptionsLocals & {
	[k: string]: unknown
}

export type RenderInnerOptions = {
	cache: Nullable<boolean>
}

export interface RenderFn {
	(view: string, options?: RenderSuppliedOptions, callback?: RenderCallback): void;
	(view: string, callback?: RenderCallback): void;
}



export type FyrejetAppProto = {
	id?: Nullable<string | number>;
	mounted: boolean;
	mountpath?: string | string[];
	path: () => string;
	parent?: FyrejetApp;

	defaultConfiguration: () => void;
	route: (path: string) => RouteFormer;

	set: AppSetFn;

	enable: (setting: string) => void;
	disable: (setting: string) => void;

	enabled: (setting: string) => boolean;
	disabled: (setting: string) => boolean;

	poweredByFn?: PoweredByFn;
	poweredBy: (res: FyrejetResponse) => void;
	init: () => void;

	engine: (ext: string, fn: RenderFunction) => FyrejetApp;

	param: (name: string, fn: ParamFn) => FyrejetApp;

	render: RenderFn;

	use(fn: unknown): FyrejetApp;
}

export type FyrejetAppPreInit = FyrejetAppProto

export type FyrejetAppHttpMethodHandlers = {
	[method in HttpMethod]: (url: string, ...args: Middleware[]) => void;
}

export type FyrejetApp = EventEmitter & FyrejetAppPreInit & FyrejetAppHttpMethodHandlers & {
	cache: FyrejetDataStorage;
	engines: FyrejetDataStorage;
	__settings: AppStorage<unknown>;
	settings: FyrejetDataStorage<unknown>;
	locals: FyrejetAppLocals;
	get: GetFn;
	
	logerror: (err: any) => void;
	getRouter: () => any;
	routes: () => string[];
	find: (method: string, url: string, req: FyrejetRequest, res: FyrejetResponse) => Match;
	lookup: (req: FyrejetRequest, res: FyrejetResponse, next: NextFunction) => void;
}


export type FyrejetErrorHandler = (err: unknown) => void

export type KeyType = string

export type AppStorage<T> = {
	keys: () => string[],
	has: (k: KeyType) => boolean,
	remove: (k: KeyType) => boolean,
	get: (k: KeyType) => T,
	getAll: () => {[key: string]: T},
	set: (k: KeyType, v: T) => AppStorage<T>,
	setOnce: (k: KeyType, v: T) => AppStorage<T>,
	reset: () => AppStorage<T>
}