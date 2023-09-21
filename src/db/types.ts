import { ChatType } from '../telegram/types';
import { TODO } from '../worker';

export abstract class Enrol implements EnrolRaw {
    uuid: string;
    linkable_name: string; //@xxx but @
    //base information of a telegram chat
    chat_id?: number;
    type: "channel"| "group" | "bot";
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
    protected constructor(base:EnrolRaw) {
        this.uuid = base.uuid
        this.linkable_name = base.linkable_name
        this.chat_id = base.chat_id
        this.type = base.type
        this.title = base.title
        this.tags = base.tags
        this.category = base.category
        this.description = base.description
        this.members_count = base.members_count
        this.create_time = base.create_time
        this.creator_chat_id = base.creator_chat_id
        this.creator_user_id = base.creator_user_id
        this.creator_username = base.creator_username
        this.creator_fullname = base.creator_fullname
        this.reviewer_id = base.reviewer_id
        this.reviewer_username = base.reviewer_username
        this.reviewer_fullname = base.reviewer_fullname
    }
    public hasLinkError(dao:DatabaseAlisObject):string|undefined {
        //?
        TODO()
    }
    public async hasError(dao:DatabaseAlisObject):Promise<string | undefined> {
        if (this.title.length>26) return "标题过长"
        if ((this.description?.length ?? 1024 )>512) return "简介过长"
        if (this.category!in await dao.categories()) {
            return "分类不存在"
        }
        return undefined
    }
}
export class TempEnrol extends Enrol {
    has_sent: boolean;
    is_passed: boolean;
    last_message_id: number;
    protected constructor(base:TempEnrolRaw) {
        super(base)
        this.has_sent = base.has_sent
        this.is_passed = base.is_passed
        this.last_message_id = base.last_message_id
    }
    reviewable():TempEnrol {
        this.is_passed = false
        this.has_sent = false
        return this
    }
}
export class RecordEnrol extends Enrol {
    hub_channel_message_id: number;
    protected constructor(base:RecordEnrolRaw) {
        super(base)
        this.hub_channel_message_id = base.hub_channel_message_id
    }
}

export interface EnrolRaw {
    uuid: string;
    linkable_name: string; //@xxx but @
    //base information of a telegram chat
    chat_id?: number;
    type: "channel"| "group" | "bot";
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
export interface TempEnrolRaw extends EnrolRaw {
    has_sent: boolean;
    is_passed: boolean;
    last_message_id: number;
}
export interface RecordEnrolRaw extends EnrolRaw {
    hub_channel_message_id: number;
}
export type Enrols = Enrol[];
export interface DatabaseAlisObject {
    updateLastMessageId(uuid: string, it: number): Promise<void>;
    updateAwaitTimeout(chatId: number, noticeMsgId: number): Promise<void>;
    findEnrolByUUID(uuid: string): Promise<Enrol|undefined>;
    categories(): Promise<string[]>;
    getTimeout(chatId: number | undefined, messageId: number): Promise<number | undefined>;
    updateEnrol(enrol: Enrol): Promise<void>;
    searchEnrolsByKeyword(keyword: string): Promise<Enrols | undefined>;
    searchEnrolsByTag(it: string[]): Promise<Enrols | undefined>;
    searchEnrolsByCategory(keyword: string): Promise<Enrols | undefined>;
    // score(): number;
    getAwaitStatus(chatId: number): Promise<AwaitInfo | undefined>;
    checkCategory(next: string): Promise<Boolean>;

    updateCategory(uuid: string, next: string): Promise<boolean>;
    getTempEnrol(uuid: string): Promise<TempEnrol | undefined>;
    updateEnrolLastMessageId(uuid: string, message_id: number): Promise<void>;
    renewTimeout(): Promise<void>;
    findRecordsBySubmitterChatId(creator_chat_id: number): Promise<Enrols>;

    saveOrGetSearchRequest(text: string, chatId: number, page: number): Promise<SearchRequest>;

    searchRecordByCategory(category: string): Promise<RecordEnrol[]>;
    searchRecordByTagCross(tags: any): Promise<RecordEnrol[]>;
    searchRecordByTitle(keywords: string[]): Promise<RecordEnrol[]>;
    searchRecordByDescription(keywords: string[]): Promise<RecordEnrol[]>;
    searchRecordByTag(keywords: string[]): Promise<RecordEnrol[]>;
    findRecordByUUID(uuid: string): Promise<RecordEnrol | undefined>;
}
export interface AwaitInfo {
    chat_id: number
    message_id: number
    callback_data: string
    timeout?: number
}
type SearchRequest = {
    //todo
}