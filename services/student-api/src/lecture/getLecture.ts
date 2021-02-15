import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../libs/response-lib.js';
import { Lecture } from '../../../admin-api/src/model/lecture';
import { LectureMaterial } from '../../../admin-api/src/model/lectureMaterial';
import { fetchStudentInfo } from '../login/get';
import { fetchWorkbooksInfo } from '../../../admin-api/src/admin/lecture/getLectures'

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
      //now fetching the user information
      const studentDetails = await fetchStudentInfo(event.userId, ' ', ' ', 'get', 1);
      if (studentDetails) delete studentDetails.password;
      event.info = studentDetails ? studentDetails : {};
      event.info = studentDetails;
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
        // get workbook information
        let enterpriseId = lectureData.enterpriseId;
        let workBooksInfo: any = await fetchWorkbooksInfo(enterpriseId);
        if ('workbooks' in event && event.workbooks.length > 0) {
          event.workbooks.forEach((workElement: any, chInd) => {
            const finalWorkBook = workBooksInfo.filter(function (e) {
              return e.workbookId === workElement.id;
            });
            workElement.workbookJapaneseName = finalWorkBook ? finalWorkBook[0].workbookJapaneseName : "";
            workElement.workbookName = finalWorkBook ? finalWorkBook[0].workbookName : "";
            let pageIdArr = workElement.pageId;
            let i = 0;
            for (let pageId of pageIdArr) {
              pageIdArr[i] = enterpriseId + '/commonfiles/workbooks/' + workElement.workbookName + '/' + pageId;
              i++;
            }
            event.workbooks[chInd] = workElement;

          });
        }
        // ========================



        let lectureCreatedDate: any = new Date(lectureData['lectureDate']);
        let currentDate: any = new Date()
        let dateDifference: any = (currentDate - lectureCreatedDate) / (1000 * 60 * 60 * 24);
        if (dateDifference > 15) {
          return { message: 'Lecture url is invalid / expired' };
        } else {
          lectureData.lectureDetails = [event];
          return lectureData;
        }
      }
    } else {
      return { message: 'No Lecture Found' };
    }
    return event;
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
