export interface CustomReply  {
   start: string;
   groupBotAuthority: string;
   groupUserAuthority: string;
   groupAnonymousAuthority: string;
   groupNotEnroll: string;
   groupEnrollerFail: string;
   enroll: string;
   enrollNeedJoinGroup: string;
   updateLink: string;
   updateLinkGroup: string;
   updateTitle: string;
   updateAbout: string;
   updateTags: string;
   updateCategory: string; //new
   enrollSubmitVerifyClassification: string;
   enrollSubmit: string;
   enrollSucceeded: string;
   enrollFailed: string;
   recordRemoved: string;
   nothing: string;
   setting: string;
   helpPrivate: string;
   helpGroup: string;
   canNotUnderstand: string;
   cancel: string;
   onlyGroup: string;
   onlyPrivate: string;
   disable: string;
   plsCheckPrivate: string;
   blacklistJoin: string;
   blacklistLeft: string;
   blacklistExistUser: string;
   blacklistExistRecord: string;
   feedbackStart: string;
   feedbackFinish: string;
   removeRecordManager: string;
   removeRecordUser: string;
   statisticsDaily: string;
   exist: string;
   banParameter: string;
   banSuccess: string;
   unbanParameter: string;
   unbanNoNeed: string;
   unbanSuccess: string;
   empty: string;
   error: string;
   await: string;

   awaitFailed: string; // new
   updateCategorySuccess: string; //new

}
export function getCustomReply(o:any):CustomReply {
   const defaultReply:CustomReply = {
      start: "欢迎使用TGNAV索引机器人!...",
      groupBotAuthority: "请先将机器人设置为群组管理员,并给予邀请成员权限。",
      groupUserAuthority: "仅群组管理员有权提交收录。",
      groupAnonymousAuthority: "请关闭匿名管理员后重试。",
      groupNotEnroll: "群组未收录,请使用 /enroll@{bot.username} 命令收录。",
      groupEnrollerFail: "仅提交者有权修改收录信息。",
      // enrollNeedChannelManager: "请先将机器人拉入频道,并设置为频道管理员。",
      enroll: "<b>提交收录说明(请务必阅读!): https://tgnav.github.io/enroll </b>...",
      enrollNeedJoinGroup: "请将机器人添加至群组中,并设为管理员。",

      updateLink: "请告诉我新的链接...",
      updateLinkGroup: "请在群组中执行 /update@{bot.username} 命令。",
      updateTitle: "请告诉我新的标题。",
      updateAbout: "请告诉我新的简介。",
      updateTags: "请告诉我新的标签...",
      updateCategory: "请告诉我新的分类...",

      enrollSubmitVerifyClassification: "请编辑分类后再次提交。",
      enrollSubmit: "提交成功~人工审核通常在10天内完成,请耐心等待!...",
      enrollSucceeded: "恭喜!您的提交已通过审核,收录成功!",
      enrollFailed: "很遗憾,您的提交未通过审核,请仔细阅读提交收录要求,并在达标后重试!短期内重复提交将被列入黑名单!",
      recordRemoved: "收录信息已被移除",
      nothing: "很抱歉,未查询到相关内容。我们会不断扩充收录的频道数量,给您带来更好的体验!感谢您的理解与支持!",
      setting: "此功能尚待完善,敬请期待!",
      helpPrivate: "以下提供常用命令及说明...\n\n私聊:\n/start 启动机器人\n/enroll 提交收录\n/update 修改收录信息\n/mine 我提交的\n/cancel 取消操作\n直接发送关键词即可进行查询\n\n群组:\n/enroll 提交收录\n/update 修改收录信息\n暂不支持在群组中查询收录信息",
      helpGroup: "/enroll@{bot.username} 收录此群组\n/update@{bot.username} 修改收录信息\n\n暂不支持在群组中查询收录信息,请在私聊中使用!",
      canNotUnderstand: "很抱歉,无法识别您的消息,请重试!",
      cancel: "当前操作已取消~",
      onlyGroup: "此命令仅在群组中可用。",
      onlyPrivate: "此命令仅在私聊中可用。",
      disable: "当前区域已禁用此功能。",
      plsCheckPrivate: "请查看私信。",
      blacklistJoin: "#{code}\n执行者:{manager}\n{black}已被加入黑名单。",
      blacklistLeft: "执行者:{manager}\n{black}已被移出黑名单。",
      blacklistExistUser: "您因违反用户使用协议,近期内将无法提交收录申请。其他功能不受限制。",
      blacklistExistRecord: "因违反用户使用协议,近期内不受理此{type}的收录申请。",
      feedbackStart: "麻烦请告知反馈内容(文字),使用 /cancel 命令取消。",
      feedbackFinish: "我们已收到您的反馈信息,感谢!",
      removeRecordManager: "执行者:{manager}\n{record}已被移除收录。",
      removeRecordUser: "{record}已被移除收录。",
      statisticsDaily: "<b>每日汇总:</b>\n日增用户:{dailyIncreaseOfUser}\n日活用户:{dailyActiveOfUser}\n用户总数量:{countOfUser}\n收录总数量:{countOfRecord}",
      exist: "已收录或已收到收录申请,无需重复提交。",
      banParameter: "错误的使用方式,请在命令后补充 ID。\n例:\n/ban@{bot.username} 825561111",
      banSuccess: "#{chat-id}\n已加入黑名单,不再为其提供任何服务。",
      unbanParameter: "错误的使用方式,请在命令后补充 ID。\n例:\n/ban@{bot.username} 825561111",
      unbanNoNeed: "黑名单中无记录,操作取消。",
      unbanSuccess: "#{chat-id}\n已从黑名单中移除,将正常为其提供服务。",
      empty: "暂无数据。",
      error: "发生未知错误。",
      await: "敬请期待~",
      awaitFailed: "请求超过十五分钟或者已经提交过了。",
      updateCategorySuccess: "分类更新成功: {{category}}",
   }

   if (o) {
      Object.keys(defaultReply).forEach(key => {
         if (o[key]) {
            (<any>defaultReply)[key] = o[key]
         }
      })
   }
   return defaultReply
}
