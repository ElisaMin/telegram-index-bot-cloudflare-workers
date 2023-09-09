import {
   ActorType,
   BaseContext,
   CallbackContext, CallbackScope,
   ChatSelector,
   CommandContext,
   ReplyForUpdateContext, ReplyScope,
   UpdateHandler
} from './contexts_type';
import { CallbackQuery, Chat, ChatType, Message, Update, User } from '../telegram/types';
import { TelegramBotApi } from '../telegram/api';
import { AwaitInfo, DatabaseAlisObject, Enrol } from '../db/types';
import { Rejecting } from '../db/ban';
import { UnexpectedError } from '../worker';
import { BotConfig } from '../bot/types';
import { custom_reply, CustomReply } from './custom_reply';

namespace ContextImpl {
   /**
    * Base Context with Constructor to make a new Context
    */
   class AbstractContext implements BaseContext {
      actor: ActorType;
      api: TelegramBotApi;
      chatId: number;
      db: DatabaseAlisObject;
      isForReviewers: boolean;
      customReply: CustomReply;
      constructor(
         base: BaseContext,
      ) {
         this.api = base.api
         this.actor = base.actor
         this.chatId = base.chatId
         this.db = base.db
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
      constructor(
         base: BaseContext,
         public readonly data: string,
         readonly index: number = 0,
         enrol?: Enrol,
      ) {
         super(base);
         let enrolAndData = data.split("#")
         let path:string|undefined = enrolAndData.shift()
         if (path) {
            this.paths = path.split("/")
         } else {
            throw new UnexpectedError("Path is not set")
         }
         this.uuid = enrolAndData?.shift()
         if (enrol)
            this.enrol = enrol
      }
      async checkEnrolInDatabase() {
         if (this.enrol) return this.enrol
         const uuid = this.uuid
         if (!uuid) return undefined
         this.enrol = await this.db.findEnrolByUUID(uuid)
         return this.enrol
      }
      get nextPath() {
         return this.paths[this.index]
      }
      protected _nextPath:string = this.nextPath
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
         return new Callback(this,this.data,this.messageId,this.callbackId,this.index+1)
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
         actor: actor, chatId: chat.id, db: this.dao,
         isForReviewers: actor == ActorType.Reviewer,
         api: this.api,customReply:this.botConfig.customReply
      }
   }

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

      const context = new ContextImpl.Callback(this.makeBaseContext(message.chat),callback_query.data,callback_query.message?.message_id??0,callback_query.id)

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

   private final?:()=>void

   answerCallback(first: string, f: (c: ChatSelector<CallbackContext>) => ChatSelector<CallbackContext>): UpdateHandler {
      if (!this.final && this.context instanceof ContextImpl.Callback) {
         if (first == this.context.nextPath) {
            const selector = new ChatSelectorImpl<CallbackContext>(this.context.actor)
            f(selector)
            const context = this.context
            const invokable = selector.invoke()
            this.final = ()=>{
               invokable(context)
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
            this.final = ()=>{
               invokable(context)
            }
         }
      }
      return this;
   }

   replyForUpdate(first: string, f: (c: ChatSelector<ReplyForUpdateContext>) => ChatSelector<ReplyForUpdateContext>): UpdateHandler {
      if (!this.final && this.context instanceof ContextImpl.Reply) {
         if (first == this.context.nextPath) {
            const selector = new ChatSelectorImpl<ReplyForUpdateContext>(this.context.actor)
            f(selector)
            const context = this.context
            const invokable = selector.invoke()
            this.final = ()=>{
               invokable(context)
            }
         }
      }
      return this;
   }

   onRejected(f: (c: ChatSelector<CommandContext>) => ChatSelector<CommandContext>): UpdateHandler {
      //TODO
      throw new Error("Method not implemented.");
   }
}

class ChatSelectorImpl<S extends BaseContext> implements ChatSelector<S>{
   protected chain:Array<(context:S)=>void> = []
   constructor(protected typeSelecting:ActorType,) {

   }
   privateChat(f:(context:S)=>void):ChatSelector<S>{
       if (ActorType.Private == this.typeSelecting) {
         this.chain.push(f)
       }
      return this
   }
   groupChat(f:(context:S)=>void):ChatSelector<S> {
      if (ActorType.Group == this.typeSelecting) {
         this.chain.push(f)
      }
      return this
   }
   reviewerChat(f:(context:S)=>void):ChatSelector<S> {
      if (ActorType.Reviewer == this.typeSelecting) {
         this.chain.push(f)
      }
      return this
   }
   anyways(f:(context:S)=>void):ChatSelector<S> {
      this.chain.push(f)
      return this
   }
   multipleChats(f:(context:S)=>void,...not:ActorType[]):ChatSelector<S>  {
      const isPush = [ActorType.Private,ActorType.Group,ActorType.Reviewer]
         .filter(t=>!not.includes(t)) //selected
         .includes(this.typeSelecting)
      if (isPush) {
         this.chain.push(f)
      }
      return this
   }
   disableRest(only?:ActorType):ChatSelector<S>  {
      let message:string|undefined
      switch (only) {
         case undefined:
            message = custom_reply.disable
            break
         case ActorType.Private:
            message = custom_reply.onlyPrivate
            break
         case ActorType.Group:
            message = custom_reply.onlyGroup
            break
         default:
            throw new UnexpectedError("Reviewer is not supported")
      }
      this.chain.push(async (context:S)=>{
         if (!message ) throw new UnexpectedError("Message is not set")
         await context.api.sendMessage({
            chat_id:context.chatId,
            text:message,
            reply_markup:{
               remove_keyboard:true
            }
         })
      })
      return this
   }

   invoke(){
       return (c:S) => {
         this.chain.forEach(f=>f(c))
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
   get db(): DatabaseAlisObject {
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