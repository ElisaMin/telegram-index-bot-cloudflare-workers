import { ActorType, UpdateHandler } from '../../contexts_type';
import { TODO } from '../../../worker';

const handlingCommands = (handler:UpdateHandler) => handler

   .command("start", (c)=>c
      .privateChat(async({data,api,chatId,customReply})=>{
         if (data) throw new Error("data not supported")
         await api.sendMessage({ chat_id: chatId, text: customReply.start })
      })
      .disableRest(ActorType.Private)
   )

   .command("help", (c)=>c
      .privateChat(async({data,api,chatId,customReply})=>{
         await api.sendMessage({ chat_id: chatId, text: customReply.helpPrivate })
      })
      .groupChat(async({data,api,chatId,customReply})=>{
         await api.sendMessage({ chat_id: chatId, text: customReply.helpGroup })
      })
      .disableRest(ActorType.Group)
   )

   .command("setting", (c)=>c
      .groupChat(async({data,api,chatId,customReply})=>{
         // await api.sendMessage({ chat_id: chatId, text: customReply.setting })
         TODO()
      })
      .disableRest(ActorType.Group)
   )
   // .command("cancel") //todo deprecated

   .command("update", (c)=>c
      .privateChat(async({data,api,chatId,customReply})=>{
         // await api.sendMessage({ chat_id: chatId, text: customReply.update })
         TODO()
   }).disableRest()
   )

   .command("mine", (c)=>c
      .privateChat(async({data,api,chatId,customReply})=>{
         // await api.sendMessage({ chat_id: chatId, text: customReply.mine })
         TODO()
      })
      .disableRest(ActorType.Private)
   )