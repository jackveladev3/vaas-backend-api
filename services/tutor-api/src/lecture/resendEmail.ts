import AWS from 'aws-sdk';
import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../libs/response-lib.js';
import config from '../../../../config.js';
import sender from '../../../../libs/sender.js';
// import { LectureMaterial } from '../model/LectureMaterial';
import { LectureMaterial } from '../../../admin-api/src/model/lectureMaterial';
import utils from '../../../../libs/util.js';
import { Student } from '../../../student-api/src/model/student';
import { Tutor } from '../../../tutor-api/src/model/tutor';
import { fetchLectureById } from '../../../admin-api/src/admin/lecture/getLecture';

// Load our secret key from SSM
const ssm = new AWS.SSM();
const sendGridLecturePromise = ssm.getParameter({
  Name: config.sendGridLectureUrl,
  WithDecryption: true
}).promise();

async function resendEmail(userId: string, lectureId: string) {
  /// fetch material assign with users
  const params = {

    TableName: 'participants',
    Key: {
      lectureId,
      userId
    },
  };
  try {
    const results = await dynamoDb.get(params);
    if (results.Item && Object.keys(results.Item).length > 0) {
      const participant: LectureMaterial = results.Item;
      let params = {};
      if (participant.userType === 0) {
        // fetch tutor
        params = {
          TableName: 'tutors',
          KeyConditionExpression: 'tutorId = :tutorId',
          ExpressionAttributeValues: {
            ':tutorId': participant.userId
          }
        };
      } else if (participant.userType === 1) {
        // fetch student
        params = {
          TableName: 'students',
          KeyConditionExpression: 'studentId = :studentId',
          ExpressionAttributeValues: {
            ':studentId': participant.userId
          }
        };

      }
      let userData: Student | Tutor;
      try {
        const result = await dynamoDb.query(params);
        userData = (participant.userType === 1) ? (result.Items[0] as Student) : (result.Items[0] as Tutor);
        let participantName = `${participant.userType === 1 ? (userData as Student).studentName : (userData as Tutor).tutorFirstName}`;
        // get lecture detail and participant details
        let adminId = userData.adminId;
        const lectureRes = await fetchLectureById(adminId, lectureId);
        let lectureStartTime;
        let studentIdArr: any = [];
        let participantArr: any = [];
        let studentDetailsArr: any = [];
        if (lectureRes.lectureDetails && Object.keys(lectureRes.lectureDetails).length > 0) {
          lectureStartTime = lectureRes.startTime;
          participantArr = lectureRes.lectureDetails;
          // get studentids and tutorid
          for (let partcipant of participantArr) {
            if (partcipant.userType === 1) {
              studentIdArr.push(partcipant.userId);
            }
          }
          // ==========================
        }
        if (studentIdArr.length > 0) {
          studentDetailsArr = await utils.getStudents({}, studentIdArr, 0);
        }

        let studentListStr = '';
        for (let student of studentIdArr) {
          studentListStr += studentDetailsArr[student].studentFamilyName + ' ' + studentDetailsArr[student].studentName + ', ';
        }
        // ==========================================

        if (userData) {
          let dynamic_template_data = {
            url: participant.lectureUrl,
            date: lectureStartTime,
            teacherflag: (participant.userType === 0) ? true : false,
            teacher: participantName,
            student: studentListStr,
            receiver: participantName,
          };

          if (userData.email && !userData.email.includes('@smartclass.jp')) {
            // fetch the value fro AWS SSM
            const sendGridLectureKey = await sendGridLecturePromise;
            let emailSentResult = await sender.sendEmailBySendGrid(
              [userData.email],
              sendGridLectureKey.Parameter.Value,
              dynamic_template_data
            );

            if (emailSentResult) {
              const params = {
                TableName: 'participants',
                Key: {
                  lectureId,
                  userId
                },
                UpdateExpression: 'SET emailSent = :emailSent',
                ExpressionAttributeValues: {
                  ':emailSent': 1
                },
                ReturnValues: 'ALL_NEW'
              };

              try {
                const result = await dynamoDb.update(params);
                return {
                  message: 'email sent successfully ',
                  data: result.Attributes
                };
              } catch (e) {
                console.log('resendEmail -> error', e);
                return {
                  message: 'Oops some error while sending email!',
                  data: {}
                };
              }
            }
          } else {
            return { message: 'no email id found' };
          }
        } else {
          return { message: 'user not found' };
        }
      } catch (e) {
        console.log('fetchStudentInfo -> error', e);
        return { message: 'user not found' };
      }
    } else {
      return { message: 'No Lecture Or User Found' };
    }
  }
  catch (error) {
    console.log('fetchMaterialByUserId -> error', error);
    return failure({ status: false });
  }
}

export async function main(event: APIGatewayEvent, _: Context) {
  let statusCode = 0;
  try {
    // validate the input data
    const body = event.body ? JSON.parse(event.body) : {};
    if (!body.userId || !body.lectureId) {
      const err = new Error(`invalid parameters`);
      statusCode = 400;
      throw err;
    }
    const result = await resendEmail(body.userId, body.lectureId);
    return success(result);
  } catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
