import { ChatType } from '../telegram/types';

export interface Enrol {
    uuid: string;
    linkable_name: string; //@xxx but @
    //base information of a telegram chat
    chat_id?: number;
    type: ChatType;
    title: string;
    //information of a record
    tags?: string[]; //包含`#`
    category?: string;
    description?: string;
    //more information for log
    members_count?: number;
    create_time: number;
    //user infos
    creator_chat_id: number;
    creator_user_id: number;
    creator_username: string;
    creator_fullname: string;
    //reviewer infos
    reviewer_id?: number;
    reviewer_username?: string;
    reviewer_fullname?: string;
}
export interface TempEnrol extends Enrol {
    has_sent: boolean;
    is_passed: boolean;
    last_message_id: number;
}
export interface RecordEnrol extends Enrol {
    hub_channel_message_id: number;
}
export type Enrols = Enrol[];
export interface DatabaseAlisObject {
    updateLastMessageId(uuid: string, it: number): Promise<void>;
    updateAwaitTimeout(chatId: number, noticeMsgId: number): Promise<void>;
    findEnrolByUUID(uuid: string): Promise<Enrol|undefined>;
    categories(): Promise<string[]>;
    getTimeout(chatId: number | null, messageId: number): Promise<number | null>;
    updateEnrol(enrol: Enrol): Promise<void>;
    searchEnrolsByKeyword(keyword: string): Promise<Enrols | null>;
    searchEnrolsByTag(it: string[]): Promise<Enrols | null>;
    searchEnrolsByCategory(keyword: string): Promise<Enrols | null>;
    // score(): number;
   getAwaitStatus(chatId: number): Promise<AwaitInfo | null>;
}
export interface AwaitInfo {
    chat_id: number
    message_id: number
    callback_data: string
    timeout?: number
}