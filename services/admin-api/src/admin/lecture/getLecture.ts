import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { Lecture } from '../../model/lecture';
import utils from '../../../../../libs/util.js';
import { fetchData } from './getLectures';

//# Method for fetching data from lectures table
export async function fetchLectureById(adminId: string, lectureId: string) {
  const params = {
    TableName: 'lectures',
    Key: {
      adminId: adminId,
      lectureId: lectureId,
    },
  };
  try {
    const results = await dynamoDb.get(params);
    let event: Lecture;
    if (results.Item && Object.keys(results.Item).length > 0 && !results.Item.deletedDate) {
      event = results.Item;

      // check if lecture is not expired (2 week validation)
      let lectureCreatedDate: any = new Date(event['lectureDate']);
      let currentDate: any = new Date()
      let dateDifference: any = (currentDate - lectureCreatedDate) / (1000 * 60 * 60 * 24);
      if (dateDifference > 15) {
        return { message: 'Lecture url is invalid / expired' };
      }
      // ===================================================

      // filter out students and tutor for batch get
      let studentIds: string[] = [];
      let tutorIds: string[] = [];

      // now fetch lecture details data from participant table
      let detailsData = await fetchData(event.lectureId, adminId);
      let dLength: number = detailsData.length;
      for (let j = 0; j < dLength; j++) {
        const element = detailsData[j];
        if (element.userId) {
          if (element.userType === 0) tutorIds.push(element.userId);
          else if (element.userType === 1) studentIds.push(element.userId);
        }

        if (j === dLength - 1) {
          // now batch get the tutors and student information
          let studentInfoResult: any = await utils.getStudents({}, studentIds, 0);
          let tutorInfoResult: any = await utils.getTutors({}, tutorIds, 0);
          for (let j = 0; j < dLength; j++) {
            const element = detailsData[j];
            const userData = element.userType === 0 ? tutorInfoResult[element.userId] : studentInfoResult[element.userId];
            if (userData.email.includes('@smartclass.jp')) {
              userData.email = "";
            }
            detailsData[j].info = userData;
          }
        }
        event.lectureDetails = detailsData;
      }
    } else {
      return { message: `No Lecture Found Or it's deleted by admin` };
    }
    return event;
  }
  catch (e) {
    console.log('error', e);
    return failure({ status: false });
  }
}



export async function main(event: APIGatewayEvent, _: Context) {
  let statusCode = 0;
  try {
    const adminId = event.requestContext.identity.cognitoIdentityId!.replace(process.env.REGION + ':', '');
    if (!adminId) {
      const err = new Error(`invalid adminId `);
      statusCode = 400;
      throw err;
    }
    //validate the input data
    if (event.pathParameters!.lectureId.toString() === 'null') {
      const err = new Error(`invalid pathParameters `);
      statusCode = 400;
      throw err;
    }
    const result = await fetchLectureById(adminId, event.pathParameters!.lectureId);
    return success(result);
  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
