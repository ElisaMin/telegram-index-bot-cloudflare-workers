import { emptyResponse, Env } from '../worker';
import { BotConfig } from './types';

export async function handle(request:Request,env:Env):Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const match = path.match(env.urlPattern)
  if (match) {
    const hash = match[1]
    if (hash.length>32) {
      const bot = getBotByHash(hash)
      if (bot) {
        //region webhook
        if (request.method == "POST") {
          return await startByBot(bot,request.json())
        }
        return await startByWebhook(bot,path,env,hash)
      }
    }
  }
  return emptyResponse()
}
async function hashBot(bot:BotConfig) {
  let word = `${bot.owner}:${bot.token}:${bot.salt}`
  let hash = new TextEncoder().encode(word).transform(async (data: Uint8Array) => {
    return await crypto.subtle.digest('SHA-256', data)
  }).transform((buffer:ArrayBuffer)=> {
    return Array.from(new Uint8Array(buffer)).map((b)=>b.toString(16).padStart(2,'0')).join('')
  })
  bot.hash = hash
  return hash
}
function getBotByHash(hash:string):BotConfig | undefined {
  return bots?.map(bot=> hashBot(bot))
    .transform(Promise.all)
    .transform((bots:BotConfig[])=> bots.find((bot)=> bot.hash == hash))
}
async function startByBot(bot:BotConfig,body:any):Promise<Response> {
  return new Response(JSON.stringify({ok:true}),{status:200})
}
async function startByWebhook(bot:BotConfig,path:string,env:Env,hash:string):Promise<Response> {
  let paths = path.split("/")
  if  (paths.length<2) {
    return emptyResponse()
  }
  let method = paths.pop()
  if(paths.pop()!="webhook"||!method)
    return emptyResponse()
  let url = `${env.apiUrl}${bot.token}/`
  switch (method) {
    case "set":
      url += `setWebhook?url=${env.webhookUrl}$`
      // replace (?:\(.+?\)) to hash
      url += env.urlPattern.replace(/\(.+?\)/, hash)
      break
    case "del":
      url += "deleteWebhook"
      break
    case "info":
      url += "getWebhookInfo"
      break
    case "getMe":
      url += "getMe"
      break
    default:
      return emptyResponse()
  }
  return fetch(url)
}