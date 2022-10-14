export type NullOrUndefined = null | undefined
export type Nullable<T> = T | NullOrUndefined
export type SingleOrArray<T> = T | T[]

export type FyrejetDataStorage<T = unknown> = {
	[k: string]: T
}

export type StringifyReplacer = (this: any, key: string, value: any) => any | (number|string)[] | null

export type NormalizeTypeOutput = { 
	value: string
}

export type EtagFn = (body: any, encoding?: string) => string

export type TrustFn = (addr: string, i: number) => boolean;

export type CreateETagGeneratorOptions = {
	weak: boolean
}