import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../libs/response-lib.js';
import { Lecture } from '../../../admin-api/src/model/lecture';
import { LectureMaterial } from '../../../admin-api/src/model/lectureMaterial';
import { fetchTutorInfo } from '../login/get';
import { fetchData } from '../../../admin-api/src/admin/lecture/getLectures';
import utils from '../../../../libs/util.js';

//# Method for fetching data from lectures table
async function fetchLectureById(lectureURLId: string) {
  const params = {
    TableName: 'participants',
    IndexName: 'lectureUrl-createdDate-index',
    KeyConditionExpression: 'lectureUrl = :lectureUrl',
    ExpressionAttributeValues: {
      ':lectureUrl': lectureURLId
    }
  };

  try {
    const results = await dynamoDb.query(params);
    let event: LectureMaterial = results.Items ? results.Items[0] : null;
    let lectureData: Lecture;

    if (event) {
      // now fetching the user information
      const tutorDetails = await fetchTutorInfo(event.userId, ' ', ' ', 'get', 1);
      if (tutorDetails) delete tutorDetails.password;
      event.info = tutorDetails ? tutorDetails : {};

      // now fetch details from lectures table
      const lectureParams = {
        TableName: 'lectures',
        IndexName: 'lectureId-lectureDate-index',
        KeyConditionExpression: 'lectureId = :lectureId',
        ExpressionAttributeValues: {
          ':lectureId': event.lectureId
        }
      };

      const lectureResults = await dynamoDb.query(lectureParams);
      if (lectureResults.Items) {
        lectureData = lectureResults.Items[0];

        if (lectureData['deletedDate'] !== null) {
          return { "message": "No Lecture Found Or it's deleted by admin" }
        }

        let lectureCreatedDate: any = new Date(lectureData['lectureDate']);
        let currentDate: any = new Date()
        let dateDifference: any = (currentDate - lectureCreatedDate) / (1000 * 60 * 60 * 24);

        if (dateDifference > 15) {
          return { message: 'Lecture url is invalid / expired' };
        } else {
          // lecture participant details
          let studentIds: string[] = [];
          let detailsData = await fetchData(event.lectureId, lectureData.adminId);
          let dLength: number = detailsData.length;
          for (let j = 0; j < dLength; j++) {
            const element = detailsData[j];
            if (element.userId) {
              if (element.userType === 1) {
                !studentIds.includes(element.userId) &&
                  studentIds.push(element.userId);
              }
            }
          }
          let studentInfoResult: any = await utils.getStudents({}, studentIds, 0);
          let participantDetails: any = [];
          for (let cIndex = 0; cIndex < dLength; cIndex++) {
            const dElement: LectureMaterial = detailsData[cIndex];
            let userData: any = {};
            if (dElement.userType === 1) {
              userData = studentInfoResult[dElement.userId];
              let lectureDetails: any = { ...dElement, info: userData ?? {} };
              participantDetails.push(lectureDetails);
            }
            // ===========================
          }

          participantDetails[participantDetails.length] = event;
          lectureData.lectureDetails = participantDetails;
          return lectureData;
        }
      } else {
        return { message: 'No Lecture Found' };
      }
      return event;
    } else {
      return { message: 'No Lecture Participant Found .' };
    }
  }
  catch (error) {
    console.log('error', error);
    return failure({ status: false });
  }
}

//# function for fetching data from lecture table for students
export async function main(event: APIGatewayEvent, _: Context) {
  let statusCode = 0;
  try {
    // validate the input data
    if (event.pathParameters!.lectureURLId.toString() === 'null') {
      const err = new Error(`invalid pathParameters `);
      statusCode = 400;
      throw err;
    }
    const result = await fetchLectureById(event.pathParameters!.lectureURLId);
    return success(result);
  } catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}

