import { DatabaseAlisObject, Enrol, TempEnrol } from '../../../db/types';
import { SendMessageLike, TelegramMessageBuilder } from '../../../utils/telegram_msg_builder';
import { callback_keys } from './router';
import { ReplyMarkup } from '../../../telegram/types';
import { CustomReply } from '../../custom_reply';
import { ActorType, CallbackContext } from '../../contexts_type';
import { unnecessary, UnexpectedError } from '../../../worker';
import { TelegramBotApi } from '../../../telegram/api';


export const renewEnrolEditingMessage:(c: { api:TelegramBotApi,enrol?:Enrol,chatId:number,actor:ActorType,dao:DatabaseAlisObject}) => Promise<void> = async ({api,enrol,chatId,actor,dao}) => {
      //clean keyboard of last editing message
      await unnecessary(()=>api.editMessageReplyMarkup({
         chat_id:chatId,
         message_id:(<TempEnrol>enrol)!.last_message_id,
         reply_markup:{inline_keyboard:[]}
      }))
      //renew
      await api.sendMessage({
         chat_id:chatId, ...enrol!.toMessage(false,true,actor==ActorType.Reviewer)
      })
         .then(async ({ message_id })=> dao.updateEnrolLastMessageId(enrol!.uuid,message_id))

   }
export namespace CallbackReply {
   export function getCategoryUpdatedMessage(this:CustomReply,category:string) {
      return this.updateCategory.replace("{{category}}",category)
   }
}


declare module '../../../db/types' {
    interface Enrol {
        link:string
        /**
         * converting an enrol to message is ready to send
         *
         * @param editing false if the message is a notification of the result, otherwise this is in updating mode
         * @param forReviewers showing if the message is for reviewers
         * @param reopen true if it's 回锅肉
         */
        toMessage(
          reopen?:boolean,
          editing?:boolean,
          forReviewers?:boolean,
        ):SendMessageLike;
    }
}
//set getter to link
Object.defineProperty(Enrol.prototype,"link",{
    get() {
        return `https://t.me/${this.linkable_name}`
    }
})

Enrol.prototype.toMessage = function (
   this:Enrol,
   editing:boolean = true,
   forReviewers:boolean = false,
   reopen:boolean = false,//is reopening or new creating/un-submitting,
) {
   const builder = new TelegramMessageBuilder()
   let markup:ReplyMarkup|undefined
   const func: (builder: TelegramMessageBuilder) => void = ({line,b,subtitle,link})=>{
      line(subtitle("标题",link(this.title,this.link)))
      line(subtitle("标签",this.tags?.join(" ") || "暂无"))
      line(subtitle("分类",this.category || "暂无"))
      line(subtitle("简介",this.description || "暂无"))
      if (forReviewers) {
         line(subtitle("提交者", this.creator_fullname)+" | "+subtitle("ID",b(this.creator_user_id.toString())))
      }
      if (editing) {
         const requestChangeEnrollCallbackData = (flied:string)=>`${callback_keys.enrol}/${callback_keys.requestChange}/${flied}#${this.uuid}`
         const {remove} = callback_keys
         const inlineBtnsRaw = [
            ["链接","link"],
            ["标题","title"],
            ["简介","detail"],
            ["标签","tags"],
            ["分类","category"],
         ].map(([editTitle,flied])=>
               ({text:`✍更新${editTitle}`,callback_data:requestChangeEnrollCallbackData(flied)})
         )

         if (!reopen) {
            if (forReviewers) {
               inlineBtnsRaw.shift();
            }
            const { passBtnData, rejectBtnData } =
               forReviewers ? {
                  passBtnData: ['通过', 'pass'],
                  rejectBtnData: ['回绝', 'reject']
               } : {
                  passBtnData: ['提交', 'submit'],
                  rejectBtnData: ['取消', remove]
               }
            inlineBtnsRaw.push({
               text: `✅${passBtnData[0]}`,
               callback_data: requestChangeEnrollCallbackData(passBtnData[1])
            });
            inlineBtnsRaw.push({
               text: `❎${rejectBtnData[0]}`,
               callback_data: requestChangeEnrollCallbackData(rejectBtnData[1])
            });
         } else {
            inlineBtnsRaw.unshift({ text: '🗑移除收录', callback_data: requestChangeEnrollCallbackData(remove) });
         }
         markup = {inline_keyboard:inlineBtnsRaw.chunk(2)}
      }
   }
   func(builder)
   return builder.withMarkup(markup)
}
