import { ActorType, UpdateHandler } from '../../contexts_type';
import { TODO, UnexpectedError } from '../../../worker';
import { ReplyMarkup } from '../../../telegram/types';


export const handleCallbackQuery = (handler:UpdateHandler) => handler
   .answerCallback(callback_keys.updateCategory, _=>_
      .anyways(async (c) => {
         if (!c.enrol) throw new UnexpectedError(`enrol not found ${c.data}`)
         let next = c.shift()
         if (next!=callback_keys.requestChange) throw new UnexpectedError(`path selecting error ${c.data}`)
         next = c.shift()
         if (!next) throw new UnexpectedError(`path selecting error ${c.data}`)
         if (!await c.dao.checkCategory(next)) throw new UnexpectedError(`not a category ${c.data}`)
         if (!await c.dao.updateCategory(c.enrol.uuid, next)) throw new UnexpectedError(`update category failed ${c.data}`)


         let keyboard:ReplyMarkup = TODO() //todo
         await c.api.sendMessage({ chat_id: c.chatId, text: c.customReply.updateCategory, reply_markup: keyboard, parse_mode: "HTML" })
         await c.answerCallback()
      })
   )
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
}
