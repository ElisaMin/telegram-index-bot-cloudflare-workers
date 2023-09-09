// eslint-disable-next-line @typescript-eslint/no-unused-vars
/**
 * telegram api types
 */
export type TelegramResponse<T> = {
    ok: boolean;
    description?: string;
    result?: T;
}

export type Update = {
    update_id: number;
    message?: Message;
    edited_message?: Message;
    channel_post?: Message;
    edited_channel_post?: Message;
    // inline_query?: InlineQuery;
    // chosen_inline_result?: ChosenInlineResult;
    callback_query?: CallbackQuery;
    // shipping_query?: ShippingQuery;
    // pre_checkout_query?: PreCheckoutQuery;
    // poll?: Poll;
    // poll_answer?: PollAnswer;
    // my_chat_member?: ChatMemberUpdated;
    // chat_member?: ChatMemberUpdated;
    chat_join_request?: ChatJoinRequest;
}
export type CallbackQuery = {
    id: string;
    from: User;
    message?: Message;
    inline_message_id?: string;
    chat_instance: string;
    data?: string;
    game_short_name?: string;
}
export enum ChatType {
  private = 'private',
  group = 'group',
  supergroup = 'supergroup',
  channel = 'channel',
}

export type Chat = {
  id: number;
  type: ChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  // photo?: ChatPhoto;
  active_usernames?: string[];
  emoji_status_custom_emoji_id?: string;
  emoji_status_expiration_date?: number;
  bio?: string;
  has_private_forwards?: boolean;
  has_restricted_voice_and_video_messages?: boolean;
  join_to_send_messages?: boolean;
  join_by_request?: boolean;
  description?: string;
  invite_link?: string;
  pinned_message?: Message;
  // permissions?: ChatPermissions;
  slow_mode_delay?: number;
  message_auto_delete_time?: number;
  has_aggressive_anti_spam_enabled?: boolean;
  has_hidden_members?: boolean;
  has_protected_content?: boolean;
  sticker_set_name?: string;
  can_set_sticker_set?: boolean;
  linked_chat_id?: number;
  // location?: ChatLocation;
}

/**
 * This interface represents a Telegram message.
 */
export interface Message {
  message_id: number;
  from?: User;
  sender_chat?: Chat;
  date: number;
  chat: Chat;
  forward_from?: User;
  forward_from_chat?: Chat;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  reply_to_message?: Message;
  via_bot?: User;
  edit_date?: number;
  has_protected_content?: boolean;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  // entities?: MessageEntity[];
  // animation?: Animation;
  // audio?: Audio;
  // document?: Document;
  // photo?: PhotoSize[];
  // sticker?: Sticker;
  // video?: Video;
  // video_note?: VideoNote;
  // voice?: Voice;
  // caption?: string;
  // caption_entities?: MessageEntity[];
  // contact?: Contact;
  // dice?: Dice;
  // game?: Game;
  // poll?: Poll;
  // venue?: Venue;
  // location?: Location;
  new_chat_members?: User[];
  left_chat_member?: User;
  new_chat_title?: string;
  // new_chat_photo?: PhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  // message_auto_delete_timer_changed?: MessageAutoDeleteTimerChanged;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: Message;
  // invoice?: Invoice;
  // successful_payment?: SuccessfulPayment;
  connected_website?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export type ChatJoinRequest = {
    chat: Chat;
    from: User;
    user_chat_id: number;
    date: number;
    bio?: string;
    // invite_link?: ChatInviteLink;
}

type ReplyKeyboardMarkup = {
  keyboard: Array<Array<KeyboardButton|string>>;
  is_persistent?: boolean;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
};
export type ReplyMarkup = ReplyKeyboardMarkup | ReplyKeyboardRemove | InlineKeyboardMarkup // | ForceReply;

type KeyboardButton = {
  text: string;
  request_user?: KeyboardButtonRequestUser;
  request_chat?: KeyboardButtonRequestChat;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: KeyboardButtonPollType;
  web_app?: WebAppInfo;
};


type KeyboardButtonRequestUser = {
  request_id: number;
  user_is_bot?: boolean;
  user_is_premium?: boolean;
};

type KeyboardButtonRequestChat = {
  request_id: number;
  chat_is_channel: boolean;
  chat_is_forum?: boolean;
  chat_has_username?: boolean;
  chat_is_created?: boolean;
  // user_administrator_rights?: ChatAdministratorRights;
  // bot_administrator_rights?: ChatAdministratorRights;
  bot_is_member?: boolean;
};

type KeyboardButtonPollType = {
  type?: 'quiz' | 'regular';
};

type ReplyKeyboardRemove = {
  remove_keyboard: true;
  selective?: boolean;
};

type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<InlineKeyboardButton>>;
};

type InlineKeyboardButton = {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: WebAppInfo;
  login_url?: LoginUrl;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  switch_inline_query_chosen_chat?: SwitchInlineQueryChosenChat;
  callback_game?: CallbackGame;
  pay?: true;
};

type SwitchInlineQueryChosenChat = {
  switch_pm_text: string;
  switch_pm_parameter: string;
};

type CallbackGame = {};

type WebAppInfo = {
  url: string;
  display_name: string;
};

type LoginUrl = {
  url: string;
  forward_text?: string;
  bot_username?: string;
  request_write_access?: boolean;
};