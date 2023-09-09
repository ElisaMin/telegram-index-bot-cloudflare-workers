import { TelegramBotApi } from '../telegram/api';
import { DatabaseAlisObject, Enrol } from '../db/types';
import { CustomReply } from './custom_reply';



export interface BaseContext {
   chatId:number
   actor:ActorType
   api:TelegramBotApi
   isForReviewers:boolean
   db:DatabaseAlisObject
   customReply:CustomReply

}
export interface UpdateHandler {
   command(command:string,f:(c:ChatSelector<CommandContext>)=>ChatSelector<CommandContext>):UpdateHandler,
   replyForUpdate(first:string,f:(c:ChatSelector<ReplyForUpdateContext>)=>ChatSelector<ReplyForUpdateContext>):UpdateHandler,
   answerCallback(first:string, f:(c:ChatSelector<CallbackContext>)=>ChatSelector<CallbackContext>):UpdateHandler,
   onRejected(f:(c:ChatSelector<CommandContext>)=>ChatSelector<CommandContext>):UpdateHandler,
}

export interface CommandContext extends BaseContext {
  command:string
  data?:string
}
export interface ReplyForUpdateContext extends BaseContext,ReplyScope { }

export interface CallbackContext extends BaseContext,CallbackScope {
  messageId:number
  callbackId:string
  answerCallback():Promise<CallbackScope>
}

export interface CallbackScope {
  data?:string
  enrol?: Enrol
  next(path?: string, callbackScope?: (scope:CallbackScope)=>void):void
  param():string | undefined
}
export interface ReplyScope {
    data?:string
    enrol?: Enrol
    dateReplyTo?:number
    editDateReplyTo?:number
    chatIdReplyTo?:number
    text?:string
//    val hasEdit:Boolean
    next(path: string, callbackScope: (scope:ReplyScope)=>void):ReplyScope
}

export interface ChatSelector<C extends BaseContext> {
  privateChat(f:(context:C)=>void):ChatSelector<C>,
  groupChat(f:(context:C)=>void):ChatSelector<C>,
  reviewerChat(f:(context:C)=>void):ChatSelector<C>,
  multipleChats(f:(context:C)=>void,...not:ActorType[]):ChatSelector<C>,
  anyways(f:(context:C)=>void):ChatSelector<C>,
  disableRest(only?:ActorType):ChatSelector<C>,
}
export enum ActorType {
  Private = "private",
  Group = "group",
  Reviewer = "reviewer",
}

