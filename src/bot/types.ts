import { CustomReply } from '../index_bot/custom_reply';

export type BotConfig = {
  owner:string,token:string,
  hash:string,salt:string,
  reviewerChatId?:number
  devChatId?:number
  customReply?:CustomReply
}
export class WebRequestError extends Error {
  constructor(message:string,cause?:any) {
    super(message);
    this.name = "WebRequestError";
    this.cause = cause
  }
}
export class TelegramError extends Error {
  constructor(message:string,cause?:any) {
    super(message);
    this.name = "TelegramError";
    this.cause = cause
  }
}
// noinspection ExceptionCaughtLocallyJS
export abstract class ApiBaseRequestWrapper {
  protected constructor(protected urlHead:string) {
    if (urlHead.endsWith("/"))
      this.urlHead = urlHead.substring(0,urlHead.length-1)
  }
  protected async post<R>(path: string, body?:any): Promise<R> {
    let url = this.urlHead + path
    let json:any
    try {
      let init = {}
      if (body != undefined) {
        init = {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json'
          }
        }
      } else {
        init = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      }
      const response = await fetch(url, init);
      if (!response.ok||response.status!==200) {
        throw {code:response.status,message:response.statusText,body:await response.text()}
      }
      json = await response.json()
    } catch (e) {
      throw new WebRequestError("Request failed",e)
    }
    try {
      if (json.ok) {
        return json.result as R
      } else {
        throw json
      }
    } catch (e) {
      throw new TelegramError("Telegram error",e)
    }
  }
}