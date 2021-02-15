import { Context } from 'aws-lambda';
import { success, failure } from '../../../../../libs/response-lib.js';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { Chat } from "../../model/chat";
import utils from '../../../../../libs/util.js';

async function fetchChatHistory(lectureId: string) {
  console.log("fetchChatHistory -> lectureId", lectureId);
  const params = {
    TableName: 'chat',
    KeyConditionExpression: 'lectureId = :lectureId',
    ExpressionAttributeValues: {
      ':lectureId': lectureId,
    },
  };
  try {
    let studentIds: string[] = [];
    let tutorIds: string[] = [];
    let adminIds: string[] = [];
    let chats: Chat[] = [];
    let length: number = 0;
    const results = await dynamoDb.query(params);
    length = results.Items!.length;
    if (results.Items!.length > 0) {
      // septate the user based on userType
      for (const key in results.Items) {
        const element: Chat = results.Items[key];
        if (element.usertype === 0) { !tutorIds.includes(element.userId) ? tutorIds.push(element.userId) : "" }
        else if (element.usertype === 1) { !studentIds.includes(element.userId) ? studentIds.push(element.userId) : "" }
        else if (element.usertype === 2) { !adminIds.includes(element.userId) ? adminIds.push(element.userId) : "" }
      }
      let studentInfoResult: any = await utils.getStudents({}, studentIds, 0);
      let tutorInfoResult: any = await utils.getTutors({}, tutorIds, 0);
      console.log("fetchChatHistory -> studentInfoResult", studentInfoResult);
      console.log("fetchChatHistory -> tutorInfoResult", tutorInfoResult, length);

      for (let index = 0; index < length; index++) {
        const element: Chat = results.Items[index];
        const userData = element.usertype === 0 ? tutorInfoResult[element.userId] : element.usertype === 1 ? studentInfoResult[element.userId] : await fetchAdminData(element.userId);
        element.userName = element.usertype === 0 ? `${userData.tutorFamilyName} ${userData.tutorFirstName}` : element.usertype === 1 ? `${userData.studentFamilyName} ${userData.studentName}` : userData !== null ? userData.administratorName : "";
        chats.push(element);
        if (index === length - 1) return chats;
      }
    }
    else {
      return results.Items;
    }
  }
  catch (err) {
    console.log('error', err);
    return failure({ status: false });
  }
}

//# Method for fetching data of admin
export async function fetchAdminData(adminId: string) {
  // fetch the data from participants table
  const params = {
    TableName: 'admin',
    KeyConditionExpression: 'adminId = :adminId',
    IndexName: 'adminId-index',
    ExpressionAttributeValues: {
      ':adminId': adminId,
    },
  };

  try {
    const results = await dynamoDb.query(params);
    console.log("fetchAdminData -> results", results);
    return results.Items.length > 0 ? results.Items[0] : null;
  }
  catch (e) {
    console.log('fetchData -> e', e);
    return failure({ status: false });
  }
}

export async function main(event: any, _: Context) {
  console.log("main -> event", event);
  try {
    // let data = JSON.parse(event.body!);
    const results: [Chat] = await fetchChatHistory(event.field!)
    console.log("main -> results", results);
    return success(results);
  }
  catch (error) {
    console.log('error', error);
    return error("statusCode", JSON.parse(event.body!));
  }
}


