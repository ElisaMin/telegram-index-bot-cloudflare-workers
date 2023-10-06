import { TelegramBotApi } from '../telegram/api';
import { DatabaseAlisObject, Enrol, RecordEnrol } from '../db/types';
import { CustomReply } from './custom_reply';
import { ChatType } from '../telegram/types';



export interface BaseContext {
   chatId:number
   actor:ActorType
   api:TelegramBotApi
   isForReviewers:boolean
   dao:DatabaseAlisObject
   customReply:CustomReply
}

export interface ContextHandler {
   command(command:string,f:(c:ChatSelector<CommandContext>)=>ChatSelector<CommandContext>):ContextHandler,
   replyForUpdate(first:string,f:(c:ChatSelector<ReplyForUpdateContext>)=>ChatSelector<ReplyForUpdateContext>):ContextHandler,
   answerCallback(first:string, f:(c:ChatSelector<CallbackContext>)=>ChatSelector<CallbackContext>):ContextHandler,
   onRejected(f:(c:ChatSelector<CommandContext>)=>ChatSelector<CommandContext>):ContextHandler,
   onSearch  (f:((c:BaseContext & {text:string,messageId:number})=>Promise<void>) ):ContextHandler,
   onDisabled(f:(c:BaseContext & {only?:ActorType })=>Promise<void>):ContextHandler,
   // x(f:(c:ChatSelector<XContext>)=>ChatSelector<XContext>):ContextHandler,
   // anyways(f:()=>void):ContextHandler,
}

export interface CommandContext extends BaseContext {
  command:string
  data?:string
}



export interface ReplyForUpdateContext extends BaseContext,ReplyScope { }

export interface CallbackContext extends BaseContext,CallbackScope {
   messageId:number
   callbackId:string
   chatType:ChatType
   answerCallback():Promise<CallbackScope>
}

export interface CallbackScope {
   data?:string
   enrol?: Enrol
   shift():string | undefined
   /**
    * /foo/bar/baz can be use by next function
    * ```
    * next(foo,{ afterPath:"bar",overPath:"baz" } =>...)
    * ```
    */
   afterPath?:string
   /**
    * @see afterPath
    */
   overPath?:string
   next(path?: string, callbackScope?: (scope:CallbackScope)=>void):CallbackScope
   param():string | undefined
   replyMsg?:{text:string,messageId:number}
}
export interface ReplyScope {
   data?:string
   enrol?: Enrol
   hint:{
      date:number
      editDate?:number
      messageId:number
      text:string
   }
   updatingData:{
      text:string
   }
   shift():string | undefined
//    val hasEdit:Boolean
    next(path: string, callbackScope: (scope:ReplyScope)=>void):ReplyScope
}

export interface ChatSelector<C extends BaseContext> {
   privateChat(f:(context:C)=>Promise<unknown>):ChatSelector<C>,
   groupChat(f:(context:C)=>Promise<unknown>):ChatSelector<C>,
   reviewerChat(f:(context:C)=>Promise<unknown>):ChatSelector<C>,
   multipleChats(not:ActorType[],f:(context:C)=>Promise<unknown>):ChatSelector<C>,
   anyways(f:(context:C)=>Promise<unknown>):ChatSelector<C>,
   disableRest(only?:ActorType):ChatSelector<C>,
   otherwise(f:(context:C)=>Promise<unknown>):ChatSelector<C>,
}
export enum ActorType {
  Private = "private",
  Group = "group",
  Reviewer = "reviewer",
}

