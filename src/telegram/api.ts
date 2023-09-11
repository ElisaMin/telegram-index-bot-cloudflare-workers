import { ApiBaseRequestWrapper } from '../bot/types';
import { Message, ReplyMarkup, User } from './types';

export class TelegramBotApi extends ApiBaseRequestWrapper {
  constructor(url: string) {
    super(url)
  }
  me?:User = undefined
  async getMe():Promise<User> {
    if (!this.me) {
      this.me = await this.post("/getMe")
    }
    return this.me
  }
  sendMessage(body:SendMessage):Promise<Message> {
    return this.post("/sendMessage",body)
  }
  sendChatAction(body:SendChatAction):Promise<boolean> {
    return this.post("/sendChatAction",body)
  }
  answerCallbackQuery(body:AnswerCallbackQuery):Promise<boolean> {
    return this.post("/answerCallbackQuery",body)
  }

}
export type Api<R> = {
}
// export class GetMe implements Api<User> {}

type AnswerCallbackQuery = Api<boolean> & {
  callback_query_id:string
  text?:string
  show_alert?:boolean
}
type SendChatAction = Api<boolean> & {
  chat_id:number|string
  action:"typing"|"upload_document"
}

export enum ParseMode {
  Markdown = "Markdown",
  HTML = "HTML"
}
export type SendMessage = Api<Message> & {
  chat_id:number|string
  text:string
  parse_mode?:ParseMode|"HTML"|"MarkdownV2"|"Markdown"
  disable_web_page_preview?:boolean
  disable_notification?:boolean
  reply_to_message_id?:number
  reply_markup?:ReplyMarkup
}
export type ForwardMessage = Api<Message> & {
  chat_id:number|string
  from_chat_id:number|string
  disable_notification?:boolean
  message_id:number
}

//editMessageText
type EditMessageText = Api<Message> & {
  chat_id?:number|string
  message_id:number|string
  inline_message_id?:string
  text:string
  parse_mode?:ParseMode
  disable_web_page_preview?:boolean
  reply_markup?:ReplyMarkup
}

type EditMessageReplyMarkup = Api<Message> & {
  chat_id?:number|string
  message_id:number|string
  inline_message_id?:string
  reply_markup?:ReplyMarkup
}