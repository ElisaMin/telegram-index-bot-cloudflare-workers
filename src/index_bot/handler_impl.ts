import {
   ActorType,
   BaseContext,
   CallbackContext, CallbackScope,
   ChatSelector,
   CommandContext,
   ReplyForUpdateContext, ReplyScope,
   ContextHandler
} from './contexts_type';
import { ChatType, Update } from '../telegram/types';
import { ParseMode, TelegramBotApi } from '../telegram/api';
import { DatabaseAlisObject, Enrol } from '../db/types';
import { Rejecting } from '../db/ban';
import { UnexpectedError } from '../worker';
import { BotConfig } from '../bot/types';
import { CustomReply } from './custom_reply';



export namespace RouterHelper {

   let context:BaseContext
   let toDev: (_?: string, __?: Error) => Promise<void> = async (_?:string, __?:Error)=>{
      throw new UnexpectedError("Dev chat id is not set")
   }
   export async function generateContext(update: Update, api: TelegramBotApi, dao: DatabaseAlisObject, botConfig: BotConfig) {
      toDev = async (s?:string,e?:Error)=>{
         let chatId = botConfig.devChatId ?? botConfig.reviewerChatId
         if (!chatId) throw new UnexpectedError("Dev chat id is not set")
         let text = `**ERROR!**\n*reason:* \`${s}\`\nupdate:\n\`\`\`\n${JSON.stringify(update)}\n\`\`\`\nstack:\n\`\`\`\n${e?.stack}\n\`\`\``
         try {
            await api.sendMessage({
               chat_id:chatId,
               text:text,
               parse_mode:ParseMode.Markdown
            })
            chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id
            if (chatId) {
               await api.sendMessage({
                  chat_id:chatId,
                  text:"这个操作出了点问题，已经通知开发者了，抱歉！",
                  parse_mode:ParseMode.Markdown
               })
            }
         } catch (e) {
            console.error(e)
            console.error(text)
         }
      }
      try {
         context = await ContextImpl.getContext(update,botConfig,dao,api)
      } catch (e) {
         if (e instanceof  UnexpectedError) {
            await toDev(e.message,e)
         } else {
            console.error(e)
            await toDev("Unknown error",e as Error)
         }
      }

   }

   export async function invoke(use:(ch:ContextHandler)=>ContextHandler) {
      try {
         if (context) await ContextImpl.useContext(context, use)()
      } catch (e) {
         if (e instanceof  UnexpectedError) {
            await toDev(e.message,e)
         } else {
            console.error(e)
            await toDev("Unknown error",e as Error)
         }
      }
   }
}

namespace ContextImpl {
   /**
    * Base Context with Constructor to make a new Context
    */
   class AbstractContext implements BaseContext {
      actor: ActorType;
      api: TelegramBotApi;
      chatId: number;
      dao: DatabaseAlisObject;
      isForReviewers: boolean;
      customReply: CustomReply;
      constructor(
         base: BaseContext,
      ) {
         this.api = base.api
         this.actor = base.actor
         this.chatId = base.chatId
         this.dao = base.dao
         this.isForReviewers = base.isForReviewers
         this.customReply = base.customReply
      }
   }

   /**
    * CommandContext Implementation
    */
   class Command extends AbstractContext implements CommandContext {
      constructor(
         base: BaseContext,
         public command: string,
         public data?: string,
      ) {
         super(base);
      }
   }
   // noinspection JSUnusedGlobalSymbols
   abstract class PathContext <S> extends AbstractContext {
      protected readonly paths: string[]
      private readonly uuid?:string
      enrol?: Enrol
      protected constructor(
         base: BaseContext,
         public readonly data: string,
         readonly index: number = 0,
         enrol?: Enrol,
      ) {
         super(base);
         let pathsEnrol = data.split("#")
         let path:string|undefined = pathsEnrol.shift()
         if (path) {
            this.paths = path.split("/")
         } else {
            throw new UnexpectedError("Path is not set")
         }
         this.uuid = pathsEnrol?.shift()
         if (enrol)
            this.enrol = enrol
      }
      get afterPath() {
         return this.paths[this.index]
      }

      get overPath() {
         return this.paths[this.index+1]
      }
      private shifted = 0
      shift() {
         this.shifted++
         return this.paths[this.index+this.shifted]
      }
      protected _nextPath:string = this.afterPath
      protected abstract getNextContext():S
      public next(path:string, callback: (scope: S) => void): S {
         if (this._nextPath == path) {
            callback(this.getNextContext())
         }
         return this.getNextContext()
      }
   }

   /**
    * Callback Implementation
    */
   class Callback extends PathContext<CallbackScope> implements CallbackContext {
      constructor(
         base: BaseContext,
         public readonly data: string,
         public readonly messageId: number,
         public readonly callbackId: string,
         public readonly chatType: ChatType,
         public readonly replyMsg?:{
            text:string
            messageId:number
         },
         public readonly index: number = 0,
         enrol?: Enrol,
      ) {
         super(base,data,index,enrol);
      }
      async answerCallback(): Promise<CallbackScope> {
         await this.api.answerCallbackQuery({
            callback_query_id: this.callbackId,
         })
         return this
      }
      param() {
         return this._nextPath.split("?")[1]
      }
      protected getNextContext() {
         return new Callback(this,this.data,this.messageId,this.callbackId,this.chatType,this.replyMsg,this.index+1)
      }
   }
   class Reply extends PathContext<ReplyScope> implements ReplyForUpdateContext {
      constructor(
         base: BaseContext,
         public readonly data: string,
         public hint: { date: number; editDate?: number; messageId: number; text: string },
         public updatingData: { text: string },
         public readonly index: number = 0,
         enrol?: Enrol,
      ) {
         super(base, data,index,enrol);
      }
      protected getNextContext(): ReplyScope {
         return new Reply(this,this.data,this.hint,this.updatingData,this.index+1)
      }

   }


   /**
    * Returns the base context for the given update, bot configuration, database alis object, and Telegram Bot API.
    *
    * @param {Update} update - The update object received from the Telegram API.
    * @param {BotConfig} botConfig - The bot configuration object.
    * @param {DatabaseAlisObject} dao - The database alis object for accessing the database.
    * @param {TelegramBotApi} api - The Telegram Bot API object for interacting with the Telegram API.
    *
    * @throws {UnexpectedError} If the chat is not set or custom reply is not set.
    * @throws {UnexpectedError} If the channel is not supported or the chat type is unknown.
    *
    * @returns {BaseContext} The base context object containing the actor type, chat ID, dao, isForReviewers flag, API, and custom reply.
    */
   function getBaseContext(update:Update,botConfig:BotConfig,dao:DatabaseAlisObject,api:TelegramBotApi):BaseContext {
      const chat = update?.callback_query?.message?.chat || update?.message?.chat
      if (!chat) throw new UnexpectedError("Chat is not set")
      if (!botConfig.customReply) throw new UnexpectedError("Custom reply is not set")
      let actor

      switch (chat.type) {
         case ChatType.channel:
            throw new UnexpectedError("Channel is not supported")
         case ChatType.private:
            actor = ActorType.Private
            break
         case ChatType.group:
         case ChatType.supergroup:
            if (chat.id == botConfig.reviewerChatId) {
               actor = ActorType.Reviewer
            } else {
               actor = ActorType.Group
            }
         default:
            throw new UnexpectedError("Unknown chat type")
      }
      return {
         actor: actor, chatId: chat.id, dao: dao,
         isForReviewers: actor == ActorType.Reviewer,
         api: api,customReply:botConfig.customReply
      }
   }
   /**
    * Generates the next context for the given base context and update.
    * ```text
    * update?.
    *    callback_query -> {
    *       data:
    *          - enrol/{curd}/more#{uuid|@linkable}
    *    }
    *    message -> {
    *       reply_to_message
    *          - db.getAwaits()? -> reply context
    *       text:
    *          - /{command}?@{me} {data} -> command context
    *          - {text} -> search context
    *     }
    * ```
    */
   async function generateNextContext(base:BaseContext,update: Update): Promise<BaseContext> {
      const reject = await Rejecting.getRejectContext(base)
      let context
      //reject
      if (reject) {
         (reject as any).name = "reject"
         return reject
      }
      //callback
      else if (update.callback_query) {
         let callback_query = update.callback_query
         const message = callback_query.message

         if (!message) throw new UnexpectedError("Message is not set")
         if (!message.chat) throw new UnexpectedError("Chat is not set")
         if (!callback_query.data) throw new UnexpectedError("Data is not set")

         let replyMsg
         if (message.reply_to_message) {
            replyMsg = {
               text:message.reply_to_message.text!,
               messageId:message.reply_to_message.message_id
            }
         }
         context = new Callback(
            base,
            callback_query.data,
            callback_query.message?.message_id??0,
            callback_query.id,
            message.chat.type,
            replyMsg
         )
      }
      if (!context && update.message && update.message.from) {
         const message = update.message
         if (!message.text) throw new UnexpectedError("Message text is not set")
         const text = message.text.trim()
         if (text.empty()) {
            throw new UnexpectedError("Message text is empty")
         }
         const callbackInfo = await base.dao.getAwaitStatus(message.chat.id)

         if (callbackInfo && callbackInfo.chat_id == message.chat.id && message.reply_to_message && message.reply_to_message.message_id == callbackInfo.message_id ) {
            const replyToMessage = message.reply_to_message
            context = new Reply(
               base,
               callbackInfo.callback_data,
               {
                  date:replyToMessage.date!,
                  editDate:replyToMessage.edit_date,
                  messageId:replyToMessage.message_id!,
                  text:replyToMessage.text!
               },{
                  text:text
               }
            )
         }
         if (!context)  {
            const username = (await base.api.getMe()).username
            if(! username) {
               throw new UnexpectedError("Bot username is not set")
            }
            //regex : ^/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?(?:\s+([\s\S]+))?$
            const match = text.match(new RegExp(
               `^\/([a-zA-Z0-9_]+)(?:@${username})?(?:\\s+([\\s\\S]+))?$`)
            )
            if (match) {
               const command:string = match[1]
               const data:string|undefined = match[2]
               if ((command.length??0)>2)
               context = new Command(base,command,data)
            } else {
               let c:any = base
               c.name = "search"
               c.text = text
               if (c.text.startsWith(`@${username}`)) {
                  c.text = c.text.substring(username.length+1)
               }
               context = c
            }
         }
      }
      if (!context) {
         throw new UnexpectedError("context not defined")
      }
      if (context.uuid) {
         let key:string = context.uuid
         if (key.startsWith("@")) {
            key = key.substring(1)
            context.enrol = await context.dao.findEnrolByLinkableName(key)
         } else {
            context.enrol = await context.dao.findEnrolByUUID(context.uuid)
         }
      }
      return context
   }
   function getCondition(of:BaseContext) {
       if (of instanceof PathContext) {
         return (first: string)=>first == of.afterPath
      } else if (of instanceof Command) {
         return (first: string)=>first == of.command
      } else return ()=>false
   }

   export function useContext(context:BaseContext,use:(h:ContextHandler)=>ContextHandler) {
      const condition = getCondition(context)
      let selected: any = undefined
      const byNamed = (named:string) => function(this:ContextHandler, f:any):ContextHandler{
         if (!selected && f.name == named) {
            selected = f
         }
         return this
      }
      const byCondition = function(this:ContextHandler, header:string, f:any):ContextHandler{
         if (!selected && condition(header)) {
            selected = f
         }
         return this
      }
      let onDisable: ((c: BaseContext & { only?: ActorType | undefined; }) => Promise<void>)
      const impl:ContextHandler = {
         onSearch  :byNamed("search"),
         onRejected:byNamed("reject"),
         onDisabled:(f)=> {
            onDisable = f
            return impl
         },
         replyForUpdate:byCondition,
         command:byCondition,
         answerCallback:byCondition
      }
      use(impl)
      if (!selected) {
         throw new UnexpectedError("out of range")
      }
      if ((<any>context).name == "search" ) {
         return async () => {
            await selected(context)
         }
      } else {
         const map:{key:string,invokable:(c:BaseContext)=>Promise<unknown>}[] = []
         let pushType = (type:ActorType|string) => function (this:ChatSelector<any>,f:any) {
            map.push({key:type,invokable:f})
            return this
         }
         const chatSelector:ChatSelector<BaseContext> = {
            privateChat: pushType(ActorType.Private),
            groupChat: pushType(ActorType.Group),
            reviewerChat: pushType(ActorType.Reviewer),
            anyways: pushType("anyways"),
            otherwise: pushType("otherwise"),
            multipleChats: (not:ActorType[]) => {
               [ActorType.Private, ActorType.Group, ActorType.Reviewer].filter((type)=> !not.includes(type)).forEach(pushType)
               return chatSelector
            },
            disableRest: (only?:ActorType) => chatSelector.otherwise(async (context:any) => {
               context.only = only
                await onDisable(context)
            })
         }
         selected(chatSelector)
         let finalList = map.filter(it=>it.key == context.actor || it.key == "anyways" || it.key == "otherwise")
         if (finalList.find(it=>it.key == context.actor)) {
            finalList.filter(it=>it.key != "otherwise")
         }
         if (finalList.length == 0 ) {
            const ctx:any = context
            throw new UnexpectedError(`select failed ${context.actor}, ${ ctx.name||typeof context} : ${ ctx.command || ctx.data || ctx.text}`)
         }
         return async () => {
            for (const f of finalList) {
               await f.invokable(context)
            }
         }

      }
   }
   export async function getContext(update:Update,botConfig:BotConfig,dao:DatabaseAlisObject,api:TelegramBotApi) {
      return await generateNextContext(getBaseContext(update,botConfig,dao,api),update)
   }
}