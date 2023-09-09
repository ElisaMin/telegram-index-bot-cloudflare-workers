import { BotConfig } from './bot/types';
import { handle } from './bot/request';

declare global {

	export interface Object {
		transform<T, R>(block: (obj: T) => R): R;
	}
	export interface String {
		empty(): boolean
		blank(): boolean
	}
	let bots: BotConfig[]|undefined;
}


Object.prototype.transform = function<T, R>(this: T, block: (obj: T) => R): R {
	return block(this);
};
String.prototype.empty = function(this: string): boolean {
	return this.length == 0;
}
String.prototype.blank = function(this: string): boolean {
	return this.trim().empty();
}
export class UnexpectedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnexpectedError";
	}
}


export interface Env {
	dataDB:D1Database
	bots:BotConfig[]
	urlPattern:string
	apiUrl:string
	webhookUrl:string
	reviewerChatId?:number
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		//region init block
		bots = env.bots
		if (!env.urlPattern || env.urlPattern.empty()) {
			env.urlPattern = "/bot/([a-zA-Z0-9]+)/.+"
		}
		if (!env.apiUrl || env.apiUrl.empty()) {
			env.apiUrl = "https://api.telegram.org/bot"
		}
		if (env.reviewerChatId) {
			bots = bots.map(bot => {
				if (!bot.reviewerChatId)
				bot.reviewerChatId = env.reviewerChatId
				return bot
			})
		}
		//endregion
		return  await handle(request, env)
	}
};
export function emptyResponse() {
	return new Response('',{status:500})
}