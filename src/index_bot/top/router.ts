import { ActorType, ReplyForUpdateContext, ContextHandler } from '../contexts_type';
import { TODO, UnexpectedError, unnecessary } from '../../worker';
import { ReplyMarkup } from '../../telegram/types';
import { buildMineResult, buildSearchResult, CallbackReply, renewEnrolEditingMessage } from './msg_builder_cb';
import { TempEnrol } from '../../db/types';
import { search } from './search';

/**
 * Represents a bot router that handles update events and routes them to the appropriate handler.
 * @param {ContextHandler} handler - The update handler function.
 * @returns {ContextHandler} - The update handler function.
 */
export const botRouter = (handler:ContextHandler): ContextHandler => handler
   .answerCallback(callback_keys.searchResult, _=>_.anyways(async ({ messageId,shift,dao,chatId,actor,api }) => {
      const uuid = shift()
      if (!uuid) throw new UnexpectedError(`uuid not found`)
      const enrol = await dao.findRecordByUUID(uuid)
      if (!enrol) throw new UnexpectedError(`enrol not found ${uuid}`)
      //todo: check if the enrol is for this chat
      const isForReviewers = actor == ActorType.Reviewer
      const isEditing = enrol.creator_chat_id == chatId

      const msg = enrol.toMessage(isEditing,isForReviewers,true)
      await api.editMessageText({
         ...msg,
         message_id: messageId,
         chat_id: chatId,
      })
   }))
   .onSearch(async ({dao,text,api,chatId,messageId,}) => {
      const s:any = buildSearchResult( await search(dao,text,chatId))
      s.reply_to_message_id = messageId
      s.chat_id = chatId
      await api.sendMessage(s)
   })
   /**
    * 分页请求
    */
   .answerCallback(callback_keys.page, _=>_.multipleChats([],async ({shift,dao,replyMsg,messageId,api,chatId})=>{
      const next = shift()
      const page = shift()
      if (isNaN(Number(page))) throw new UnexpectedError(`page is not a number ${page}`)
      if (next == callback_keys.search) {
            const send = {
               ...buildSearchResult(await search(dao,replyMsg!.text!,chatId)),
               reply_to_message_id: replyMsg!.messageId,
               message_id: messageId,
               chat_id: chatId
            }
         await api.editMessageText(send)
      }
   }))
   //region commands
   /**
    * Bot的开始命令
    */
   .command("start", (c)=>c
      .privateChat(async({api,chatId,customReply})=>{
         await api.sendMessage({ chat_id: chatId, text: customReply.start })
      })
      .disableRest(ActorType.Private)
   )
   /**
    * Bot的帮助命令
    */
   .command("help", (c)=>c
      .privateChat(async({data,api,chatId,customReply})=>{
         await api.sendMessage({ chat_id: chatId, text: customReply.helpPrivate })
      })
      .groupChat(async({data,api,chatId,customReply})=>{
         await api.sendMessage({ chat_id: chatId, text: customReply.helpGroup })
      })
      .disableRest(ActorType.Group)
   )

   .command("mine", (c)=>c
      .privateChat(async({api,chatId,customReply,dao,})=>{
         await api.sendMessage({
            ...buildMineResult(customReply,await dao.findRecordsBySubmitterChatId(chatId)),
            chat_id: chatId,
         })
      })
      .disableRest(ActorType.Private)
   )
   //endregion
   /**
    * 修改enrol请求
    */
   .replyForUpdate(callback_keys.enrol, _=>_.anyways(async (c) => {

      let { api,chatId,dao,customReply,shift,enrol,data,hint,updatingData } = c
      c.api.sendChatAction({ chat_id:chatId,action: "typing" })

      if (await hasEditOrTimeout(c)) {
         await api.sendMessage({ chat_id: chatId, text: customReply.awaitFailed })
         return
      }

      if (shift()!=callback_keys.requestChange) throw new UnexpectedError(`path selecting error ${data}`)

      if (!enrol) throw new UnexpectedError("enrol not found")
      if (enrol !instanceof TempEnrol) {
         enrol = await dao.getTempEnrol(enrol.uuid)
         if (!enrol) throw new UnexpectedError("enrol not found")
      }
      let text = updatingData.text.trim()
      if (!text||text.empty()) throw new UnexpectedError("text not found")

      const next = shift()
      if (!next) throw new UnexpectedError(`path selecting error ${shift()}`)
      switch (next) {
         case "title":
            enrol.title = text
            break;
         case "detail": // description
            enrol.description = text
            break;
         case "tags":
            enrol.tags = text.tags()
            break;
         default:
            throw new UnexpectedError(`path selecting error ${data}`)
         // case "link":
         //    TODO()
      }
      const err = await enrol.hasError(dao)
      await api.editMessageText( {chat_id:chatId,text:hint.text+"（以失效）",message_id:hint.messageId })
      if (err) {
         await api.sendMessage({ chat_id: chatId, text: `失败,${err},请修改和回复本条消息` })
         //todo: update timeout
         return
      }



      //todo: delete await state
      await renewEnrolEditingMessage(c)
   }))
   /**
    * 分组更新请求 直接更新
    * from button
    */
   .answerCallback(callback_keys.updateCategory, _=>_
      .anyways(async (c) => {
         await c.answerCallback()
         if (!c.enrol) throw new UnexpectedError(`enrol not found ${c.data}`)
         if (c.enrol !instanceof TempEnrol) {
            c.enrol = await c.dao.getTempEnrol(c.enrol.uuid)
            if (!c.enrol) throw new UnexpectedError(`enrol not found ${c.data}`)
         }
         let next = c.shift()
         if (next!=callback_keys.requestChange) throw new UnexpectedError(`path selecting error ${c.data}`)
         next = c.shift()
         if (!next) throw new UnexpectedError(`path selecting error ${c.data}`)
         if (!await c.dao.checkCategory(next)) throw new UnexpectedError(`not a category ${c.data}`)
         if (!await c.dao.updateCategory(c.enrol.uuid, next)) throw new UnexpectedError(`update category failed ${c.data}`)
         c.enrol = await c.dao.findEnrolByUUID(c.enrol.uuid)
         if (!c.enrol) throw new UnexpectedError(`enrol not found ${c.data}`)

         await c.api.sendMessage({ chat_id: c.chatId, text: CallbackReply.getCategoryUpdatedMessage.call(c.customReply,next), parse_mode: "HTML" })
         await renewEnrolEditingMessage(c)
      })
   )
   /**
    * 更新enrol请求 发送回复更新消息。
    */
   .answerCallback(callback_keys.enrol, _=>_
      .multipleChats([ActorType.Group],async (c) => c
         .next(callback_keys.requestChange,  async({ shift,data  }) => {
            const next = shift()
            if (!next) throw new UnexpectedError(`path selecting error ${data}`)
            let key
            switch (next) {
               case "title":
                  key = "updateTitle"
                  break;
               case "detail": // description
                  key = "updateAbout"
                  break;
               case "tags":
                  key = "updateTags"
                  break;
               case "link":
                  TODO() // todo update link
            }
            if (key) {
               let aC = c.answerCallback()
               //todo state this chat to await
               const reply:string|undefined = (<any>c.customReply)[key]
               if (!reply) throw new UnexpectedError(`key not found ${key}`)
               await aC
               await c.api.sendMessage({ chat_id: c.chatId, text: reply })
               return
            } else if (next == "category") {
               let keyboard:ReplyMarkup = TODO() //todo
               await c.api.sendMessage({ chat_id: c.chatId, text: c.customReply.updateCategory, reply_markup: keyboard, parse_mode: "HTML" })
               await c.answerCallback()
            } else if (next == callback_keys.remove) {
               const param = shift()
               switch (param) {
                  case undefined:
                     //todo send message with keyboard say yes or not
                     break
               }
            } else if (next == "pass") {
               TODO()
            } else if (next == "reject") { //not pass
               TODO()
            } else if (next == "submit") {
               TODO()
            } else {
               throw new UnexpectedError(`path selecting error ${data}`)
            }
         })
         .next("pass", TODO)
      )
   )



export const callback_keys = {
   enrol: "nrl",
   page: "p",
   updateCategory: "ctg",

   requestChange: "r",
   remove: "c",
   search: "s",
   //preview detail
   searchResult:"d"
}
async function hasEditOrTimeout(c: ReplyForUpdateContext): Promise<boolean> {
   const { dao, chatId, hint } = c
   await unnecessary(dao.renewTimeout)
   const now = Date.now()
   const timeout = await dao.getTimeout(chatId, hint.messageId)
   if (timeout) {
      if (timeout<now) return true
   }
   if (hint.editDate) {
      if (hint.editDate + 1000 * 60 * 5 > now) return true
   }
   return hint.editDate!=null
}