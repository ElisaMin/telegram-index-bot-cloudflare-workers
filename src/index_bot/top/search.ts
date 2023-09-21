import { DatabaseAlisObject, Enrols, RecordEnrol } from '../../db/types';
import { TODO, UnexpectedError } from '../../worker';



export async function search(dao: DatabaseAlisObject, text: string, chatId: number, page: number = 1) {
   await dao.saveOrGetSearchRequest(text, chatId, page)

   const keywords = text.split(" ")

   const searched: RecordEnrol[] = []
   const notSort: RecordEnrol[] = []
   //concat
   const sorted = () => notSort.concat(sortByKeywords(keywords, searched))
   //category
   let temp = keywords.filter(s => s.length == 4 && !s.startsWith("#"))
   if (temp.isNotEmpty()) {
      for (let category of temp) {
         searched.push(...await dao.searchRecordByCategory(category))
      }
   }
   if (searched.isNotEmpty()) {
      return sorted()
   }
   //tags match
   temp = keywords.filter(_ => _.startsWith("#"))
      .map(_ => _.slice(1))
   if (temp.isNotEmpty()) {
      notSort.push(...await dao.searchRecordByTagCross(temp))
   }
   //title
   temp = keywords.filter(_ => !_.startsWith("#"))
   if (temp.isNotEmpty()) {
      notSort.push(...await dao.searchRecordByTitle(temp))
   }
   //description
   temp = keywords.filter(_ => !_.startsWith("#"))
   if (temp.isNotEmpty()) {
      searched.push(...await dao.searchRecordByDescription(temp))
   }
   //tags
   temp = keywords.filter(_ => _.startsWith("#"))
      .map(_ => _.slice(1))
   temp.push(...keywords.filter(_ => !_.startsWith("#")))
   if (temp.isNotEmpty()) {
      searched.push(...await dao.searchRecordByTag(temp))
   }
   return sorted()
}
function sortByKeywords(keywords:string[],records:RecordEnrol[]):RecordEnrol {
   TODO() // 计算距离
}