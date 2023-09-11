import {
   ActorType,
   BaseContext,
   CallbackContext, CallbackScope,
   ChatSelector,
   CommandContext,
   ReplyForUpdateContext, ReplyScope,
   UpdateHandler
} from './contexts_type';
import { CallbackQuery, Chat, ChatType, Message, Update } from '../telegram/types';
import { ParseMode, TelegramBotApi } from '../telegram/api';
import { AwaitInfo, DatabaseAlisObject, Enrol } from '../db/types';
import { Rejecting } from '../db/ban';
import { TODO, UnexpectedError } from '../worker';
import { BotConfig } from '../bot/types';
import { CustomReply } from './custom_reply';

export namespace Handler {

   let handler: UpdateHandler | undefined = undefined;
   let toDev: (_?: string, __?: Error) => Promise<void> = async (_?:string, __?:Error)=>{
      throw new UnexpectedError("Dev chat id is not set")
   }

   export async function init(update: Update, api: TelegramBotApi, dao: DatabaseAlisObject, botConfig: BotConfig) {
      if (!handler) {
         const _handler = new UpdateHandlerImpl(update,api,dao,botConfig)
         await _handler.task
         handler = _handler
      }
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
   }

   export async function use(f:(handler:UpdateHandler)=>UpdateHandler) {
      if (!handler) throw new UnexpectedError("Handler is not set")
      handler = f(handler)
   }
   export async function collect() {
      TODO()
   }

   export async function invoke() {
      try {
         if (!handler||handler !instanceof UpdateHandlerImpl) {
            // noinspection ExceptionCaughtLocallyJS
            throw new UnexpectedError("Handler is not set")
         }
         const _handler = <UpdateHandlerImpl> handler
         if (!_handler.final) {
            // noinspection ExceptionCaughtLocallyJS
            throw new UnexpectedError("Handler is not set")
         }
         await _handler.final();

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
   export class Command extends AbstractContext implements CommandContext {
      constructor(
         base: BaseContext,
         public command: string,
         public data?: string,
      ) {
         super(base);
      }
   }
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
      async checkEnrolInDatabase() {
         if (this.enrol) return this.enrol
         const uuid = this.uuid
         if (!uuid) return undefined
         this.enrol = await this.dao.findEnrolByUUID(uuid)
         return this.enrol
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
   export class Callback extends PathContext<CallbackScope> implements CallbackContext {
      constructor(
         base: BaseContext,
         public readonly data: string,
         public readonly messageId: number,
         public readonly callbackId: string,
         public readonly chatType: ChatType,
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
         return new Callback(this,this.data,this.messageId,this.callbackId,this.chatType,this.index+1)
      }
   }
   export class Reply extends PathContext<ReplyScope> implements ReplyForUpdateContext {
      constructor(
         base: BaseContext,
         public readonly data: string,
         public readonly dateReplyTo: number,
         public readonly editDateReplyTo: number|undefined,
         public readonly chatIdReplyTo: number,
         public readonly text: string,
         public readonly index: number = 0,
         enrol?: Enrol,
      ) {
         super(base, data,index,enrol);
      }

      protected getNextContext(): ReplyScope {
         return new Reply(this,this.data,this.dateReplyTo,this.editDateReplyTo,this.chatIdReplyTo,this.text,this.index+1)
      }
   }

}


class UpdateHandlerImpl implements UpdateHandler {
   private context:BaseContext|undefined
   task?:Promise<void>
   constructor(
      protected update:Update,
      private api:TelegramBotApi,
      private dao:DatabaseAlisObject,
      private botConfig:BotConfig,
   ) { this.task = (async ()=>{
      let getme = api.getMe()

      if (false) {
         throw new UnexpectedError("Unreachable")
      }

      else if (update.callback_query) {

         if (await Rejecting.checkDeserving(<number>update.callback_query.message?.chat?.id)) {
            this.makeRejectContext()
            return
         }

         await this.makeCallbackContext(update.callback_query)

      }

      else if (update.message&&update.message.from) {

         if (await Rejecting.checkDeserving(update.message.chat.id)) {
            this.makeRejectContext()
            return
         }

         const message = update.message
         const awaitState = await this.dao.getAwaitStatus(message.chat.id)
         if (awaitState && awaitState.chat_id == message.chat.id && message.reply_to_message && message.reply_to_message.message_id == awaitState.message_id ) {
            await this.makeReplyContext(awaitState,message)
         } else {
            await this.makeCommandContext(message)
         }

      }

      else {
         // do nothing
      }

      await getme

   })() }

   private makeBaseContext(chat:Chat):BaseContext {
      if (!this.botConfig.customReply) throw new UnexpectedError("Custom reply is not set")
      let actor
      switch (chat.type) {
         case ChatType.channel:
            throw new UnexpectedError("Channel is not supported")
         case ChatType.private:
            actor = ActorType.Private
            break
         case ChatType.group:
         case ChatType.supergroup:
            if (chat.id == this.botConfig.reviewerChatId) {
               actor = ActorType.Reviewer
            } else {
               actor = ActorType.Group
            }
      }
      return {
         actor: actor, chatId: chat.id, dao: this.dao,
         isForReviewers: actor == ActorType.Reviewer,
         api: this.api,customReply:this.botConfig.customReply
      }
   }

   //region make context
   private async makeCommandContext(message: Message) {
      if (this.context) return
      const me = await this.api.getMe()
      if(!me.username) {
         throw new UnexpectedError("Bot username is not set")
      }
      //regex : ^/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?(?:\s+([\s\S]+))?$
      const match = message.text?.match(new RegExp(
         `^\/([a-zA-Z0-9_]+)(?:@${me.username})?(?:\\s+([\\s\\S]+))?$`)
      )
      if (match) {
         const command:string = match[1]
         const data:string|undefined = match[2]
         this.context = new ContextImpl.Command(this.makeBaseContext(message.chat),command,data)
      }
   }

   private async makeCallbackContext(callback_query: CallbackQuery) {
      if (this.context) return
      const message = callback_query.message

      if (!message) throw new UnexpectedError("Message is not set")
      if (!message.chat) throw new UnexpectedError("Chat is not set")
      if (!callback_query.data) throw new UnexpectedError("Data is not set")

      const context = new ContextImpl.Callback(this.makeBaseContext(message.chat),callback_query.data,callback_query.message?.message_id??0,callback_query.id,message.chat.type)

      await context.checkEnrolInDatabase()
      this.context = context
   }
   private async makeReplyContext(awaitState:AwaitInfo,message:Message) {
      if (this.context) return

      if (!message.reply_to_message) throw new UnexpectedError("Reply to message is not set")
      if (!message.text) throw new UnexpectedError("Message text is not set")

      const replyToMessage = message.reply_to_message
      const context = new ContextImpl.Reply(this.makeBaseContext(message.chat),awaitState.callback_data, replyToMessage.date, replyToMessage.edit_date, replyToMessage.chat.id, message.text)

      await context.checkEnrolInDatabase()
      this.context = context

   }

   private makeRejectContext() {
      this.context = new RejectedContextImpl()
   }
   //endregion

   final?:()=>Promise<void>

   answerCallback(first: string, f: (c: ChatSelector<CallbackContext>) => ChatSelector<CallbackContext>): UpdateHandler {
      if (!this.final && this.context instanceof ContextImpl.Callback) {
         if (first == this.context.afterPath) {
            const selector = new ChatSelectorImpl<CallbackContext>(this.context.actor)
            f(selector)
            const context = this.context
            const invokable = selector.invoke()
            this.final = async ()=>{
               await invokable(context)
            }
         }
      }
      return this;
   }

   command(command: string, f: (c: ChatSelector<CommandContext>) => ChatSelector<CommandContext>): UpdateHandler {
       if (!this.final && this.context instanceof ContextImpl.Command) {
         if (command == this.context.command) {
            const selector = new ChatSelectorImpl<CommandContext>(this.context.actor)
            f(selector)
            const context = this.context
            const invokable = selector.invoke()
            this.final = async ()=>{
               await invokable(context)
            }
         }
      }
      return this;
   }

   replyForUpdate(first: string, f: (c: ChatSelector<ReplyForUpdateContext>) => ChatSelector<ReplyForUpdateContext>): UpdateHandler {
      if (!this.final && this.context instanceof ContextImpl.Reply) {
         if (first == this.context.afterPath) {
            const selector = new ChatSelectorImpl<ReplyForUpdateContext>(this.context.actor)
            f(selector)
            const context = this.context
            const invokable = selector.invoke()
            this.final = async ()=>{
              await invokable(context)
            }
         }
      }
      return this;
   }

   onRejected(f: (c: ChatSelector<CommandContext>) => ChatSelector<CommandContext>): UpdateHandler {
      //TODO
      TODO()
   }
}

class ChatSelectorImpl<S extends BaseContext> implements ChatSelector<S>{
   protected chain:Array<(context:S)=>Promise<unknown>> = []
   private addedTypes = new Set<ActorType>()
   constructor(protected typeSelecting:ActorType,) {}

   private selecting(type:ActorType,f:(context:S)=>Promise<unknown>) {
      if (type == this.typeSelecting) {
         this.chain.push(f)
      }
      this.addedTypes.add(type)
      return this
   }
   privateChat(f:(context:S)=>Promise<unknown>):ChatSelector<S>{
      this.selecting(ActorType.Private,f)
      return this
   }
   groupChat(f:(context:S)=>Promise<unknown>):ChatSelector<S> {
      this.selecting(ActorType.Group,f)
      return this
   }
   reviewerChat(f:(context:S)=>Promise<unknown>):ChatSelector<S> {
      this.selecting(ActorType.Reviewer,f)
      return this
   }
   anyways(f:(context:S)=>Promise<unknown>):ChatSelector<S> {
      this.chain.push(f)
      return this
   }
   multipleChats(not:ActorType[],f:(context:S)=>Promise<unknown>):ChatSelector<S>  {
      [ActorType.Private, ActorType.Group, ActorType.Reviewer]

         .filter((type)=> !not.includes(type))

         .forEach(t=>this.selecting(t,f))

      return this
   }
   disableRest(only?:ActorType):ChatSelector<S>  {
      if (!this.addedTypes.has(this.typeSelecting)) {
         let key:string|undefined
         switch (only) {
            case ActorType.Reviewer:
            case undefined:
               key = "disable"
               break
            case ActorType.Private:
               key = "onlyPrivate"
               break
            case ActorType.Group:
               key = "onlyGroup"
               break
            default:
               throw new UnexpectedError("Unknown actor type")
         }
         this.chain.push(async (context:S)=> {
            if (!key ) throw new UnexpectedError("cant find key of disabling")
            const message = (<any>context.customReply)[key]
            if (!message) throw new UnexpectedError("cant find message of disabling")
            await context.api.sendMessage({
               chat_id:context.chatId,
               text:message,
            })
         })
      }
      return this
   }
   otherwise(f:(context:S)=>Promise<unknown>) {
      if (!this.addedTypes.has(this.typeSelecting)) {
         this.chain.push(f)
      }
      return this
   }

   invoke() {
       return async (c:S) => {
         for (const f of this.chain) {
            await f(c);
         }
      }
   }

}
//TODO
class RejectedContextImpl implements BaseContext {

   get api(): TelegramBotApi {
       throw new Error("Method not implemented.");
   }
   get chatId(): number {
       throw new Error("Method not implemented.");
   }
   get dao(): DatabaseAlisObject {
       throw new Error("Method not implemented.");
   }
   get isForReviewers(): boolean {
       throw new Error("Method not implemented.");
   }
   get actor(): ActorType {
      throw new Error("Method not implemented.");
   }
   get customReply(): CustomReply {
      throw new Error("Method not implemented.");
   }
}