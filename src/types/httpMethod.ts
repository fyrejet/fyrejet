import Methods from '../routing/methods'

const httpMethods = [...Methods] as const
export type HttpMethod = typeof httpMethods[number]