import { ReplyMarkup } from '../telegram/types';


export class TelegramMessageBuilder {
   constructor(public data: string = '') {}

   line(text: string) {
      this.data += text + '\n';
   }

   b(text: string): string {
      return `<b>${text}</b>`;
   }

   i(text: string): string {
      return `<i>${text}</i>`;
   }

   code(text: string): string {
      return `<code>${text}</code>`;
   }

   del(text: string): string {
      return `<del>${text}</del>`;
   }

   pre(text: string): string {
      return `<pre>${text}</pre>`;
   }

   link(text: string, link: string): string {
      return `<a href='${link}'>${text}</a>`;
   }

   subtitle = (title: string, s: string) => `${this.b(title)}: ${s}`;

   withMarkup(markup?: ReplyMarkup): SendMessageLike {
      return {
         text: this.data,
         keyboard: markup
      };
   }

}

export type SendMessageLike = {
   text: string,
   keyboard?: ReplyMarkup
}