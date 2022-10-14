import finalhandler from "finalhandler"
import { GetSetting, type FyrejetRequest} from "./types"

export const defaultErrHandler = (req: FyrejetRequest, err?: unknown) => {
	const {res} = req
	if (res.writableEnded) return console.log(err)

	const fh = finalhandler(req, res, {
	  env: (req.app.get as GetSetting)('env') as string, // in this case app.get is used to grab settings
	  onerror: req.app.logerror
	})

	if (req.method !== 'OPTIONS') {
	  return fh(err)
	}

	const options = req.app.getRouter().availableMethodsForRoute[req.url as string]
	if (!options) {
	  return fh(err || false)
	}
	const optionsString = options.join(',')
	res.setHeader('Allow', optionsString)
	res.setHeader('Content-Type', 'text/html; charset=utf-8')
	res.statusCode = 200
	return res.end(optionsString)
}

export default defaultErrHandler