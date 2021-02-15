import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { Lecture } from '../../model/lecture';
import { LectureMaterial } from '../../model/lectureMaterial';
import utils from '../../../../../libs/util.js';
import { fetchAdminInfo } from "../login/login"

//# Method for fetching data from lectures table
async function fetchLectures(adminId: string, lookingFor: string, monthNumber: number, date: string, currentYear: any) {
  const params = {
    TableName: 'lectures',
    IndexName: 'adminId-startTime-index',
    KeyConditionExpression: 'adminId = :adminId',
    ScanIndexForward: true,
    ExpressionAttributeValues: {
      ':adminId': adminId,
    },
  };
  try {
    const results = await dynamoDb.query(params);
    let lectures: Lecture[] | any[] = [];
    let finalLectures: Lecture[] = [];
    if (results.Items) {
      // const currentYear = new Date().getFullYear();
      // filter data as per looking param
      switch (lookingFor) {
        case 'month':
          lectures = results.Items.filter((e) => {
            let [year, month, day] = e.lectureDate.split('-');
            year = parseInt(year);
            month = parseInt(month);
            day = parseInt(day);
            return (((+monthNumber === +month && currentYear == year) && !e.deletedDate));
          });
          break;

        case 'day':
          lectures = results.Items.filter((e) => {
            let [year, month, day] = e.lectureDate.split('-');
            return (+monthNumber === +month && +date === +day && currentYear == year && !e.deletedDate);
          });
          break;

        default:
          break;
      }

      // filter out students and tutor for batch get
      let lLength: number = lectures.length;
      let studentIds: string[] = [];
      let tutorIds: string[] = [];
      let index: number = 0;
      // now fetch lecture details data from participant table
      for (index = 0; index < lLength; index++) {
        const element = lectures[index];
        let detailsData = await fetchData(element.lectureId, adminId);
        let dLength: number = detailsData.length;
        for (let j = 0; j < dLength; j++) {
          const element = detailsData[j];

          if (element.userId) {
            if (element.userType === 0) {
              !tutorIds.includes(element.userId) &&
                tutorIds.push(element.userId);
            } else if (element.userType === 1) {
              !studentIds.includes(element.userId) &&
                studentIds.push(element.userId);
            }
          }
        }
        element.lectureDetails = detailsData;
        finalLectures.push(element);
      }

      // now finally inject tutor and students info using batch get
      let fLength: number = finalLectures.length;
      if (index === lLength && lLength > 0) {
        // now batch get the tutors and student information
        let studentInfoResult: any = await utils.getStudents({}, studentIds, 0);
        let tutorInfoResult: any = await utils.getTutors({}, tutorIds, 0);
        for (let j = 0; j < fLength; j++) {
          const lElement: [LectureMaterial] = finalLectures[j].lectureDetails;
          for (let cIndex = 0; cIndex < lElement.length; cIndex++) {
            const dElement: LectureMaterial = lElement[cIndex];
            const userData = dElement.userType === 0 ? tutorInfoResult[dElement.userId] : studentInfoResult[dElement.userId];
            if (userData.email.includes('@smartclass.jp') && userData.userType === 1) userData.email = "";
            finalLectures[j].lectureDetails[cIndex] = { ...dElement, info: userData ?? {} };
          }
        }
      }
    }

    return finalLectures;
  }
  catch (e) {
    console.log('error', e);
    return failure({ status: false });
  }
}
//# Method for fetching data participants
export async function fetchData(id: string, adminId: string = "") {
  // fetch the data from participants table
  const params = {
    TableName: 'participants',
    KeyConditionExpression: 'lectureId = :lectureId',
    ExpressionAttributeValues: {
      ':lectureId': id,
    },
  };

  try {
    const results = await dynamoDb.query(params);
    const length = results.Count;
    let workBooksInfo;
    let enterpriseId;
    if (length > 0) {
      // first need to fetch admin info from admin table
      const adminData = await fetchAdminInfo('', adminId, 1);
      enterpriseId = adminData.enterpriseId;
      if (adminData) {
        workBooksInfo = await fetchWorkbooksInfo(adminData.enterpriseId);
      }
    }
    for (let index = 0; index < length; index++) {
      const element: LectureMaterial = results.Items[index];
      if ('workbooks' in element && element.workbooks.length > 0) {
        element.workbooks.forEach((workElement: any, chInd) => {
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
          results.Items[index].workbooks[chInd] = workElement;

        });
      }
    }
    return results.Items;
  }
  catch (e) {
    console.log('fetchData -> e', e);
    return failure({ status: false });
  }
}

//# Method for fetching data from workbooks table
export async function fetchWorkbooksInfo(enterpriseId: string) {
  let params = {};

  params = {
    TableName: 'workBook',
    KeyConditionExpression: 'enterpriseId = :enterpriseId',
    ExpressionAttributeValues: {
      ':enterpriseId': enterpriseId,
    },
  };
  try {
    const result = await dynamoDb.query(params);
    let workbooksArr = [];
    if (result && result.Items && result.Items.length > 0) {
      workbooksArr = result.Items;
      return workbooksArr;
    } else {
      return workbooksArr;
    }
  }
  catch (e) {
    console.log('fetchWorkbooksInfo -> error', e);
    return ({ status: false });
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

    // validate the input data
    if (event.pathParameters!.monthNumber.toString() === 'null' && event.pathParameters!.date.toString() === 'null') {
      const err = new Error(`invalid pathParameters `);
      statusCode = 400;
      throw err;
    }

    let lookingFor =
      event.pathParameters!.monthNumber.toString() !== 'null' &&
        event.pathParameters!.date.toString() !== 'null'
        ? 'day'
        : event.pathParameters!.monthNumber.toString() !== 'null' &&
          event.pathParameters!.date.toString() === 'null'
          ? 'month'
          : 'none';
    let monthNumber = event.pathParameters!.monthNumber;
    let date = event.pathParameters!.date;
    let year = (event && event.pathParameters!.year !== undefined && event.pathParameters!.year !== 'null') ? event.pathParameters!.year : new Date().getFullYear();
    console.log('===year===', year);
    const result = await fetchLectures(adminId, lookingFor, parseInt(monthNumber), date, year);
    return success(result);
  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
