import * as AWS from 'aws-sdk';
import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import utils from '../../../../../libs/util.js';
import config from '../../../../../config.js';
import sender from '../../../../../libs/sender.js';
import { Student } from '../../../../student-api/src/model/student';
import { Tutor } from '../../../../tutor-api/src/model/tutor';
import { fetchLectureById } from '../lecture/getLecture';

// Load our secret key from SSM
const ssm = new AWS.SSM();
const sendGridLecturePromise = ssm.getParameter({
  Name: config.sendGridLectureUrl,
  WithDecryption: true
}).promise();

async function resendEmail(userId: string, lectureId: string, adminId: string = '') {
  try {

    const lectureRes = await fetchLectureById(adminId, lectureId);
    if (lectureRes.lectureDetails && Object.keys(lectureRes.lectureDetails).length > 0) {
      let lectureStartTime = lectureRes.startTime;
      const participantArr: any = lectureRes.lectureDetails;
      let studentIdArr: any = [];
      let tutorId;
      let participant;

      // get studentids and tutorid
      for (let partcipant of participantArr) {
        if (partcipant.userType === 1) {
          studentIdArr.push(partcipant.userId);
        } else {
          tutorId = partcipant.userId
        }
        if (partcipant.userId === userId) {
          participant = partcipant;
        }
      }
      // ==========================

      // get student details
      let tutorDetail;
      let tutorName;
      let studentDetailsArr = await utils.getStudents({}, studentIdArr, 0);
      if (tutorId !== undefined) {
        let tutorRes = await utils.getTutor(tutorId);
        if (tutorRes.Items.length > 0) {
          tutorDetail = tutorRes.Items[0];
          tutorName = tutorDetail.tutorFamilyName + ' ' + tutorDetail.tutorFirstName;
        }
      }
      // ===================
      let studentListStr = '';
      for (let student of studentIdArr) {
        studentListStr += studentDetailsArr[student].studentFamilyName + ' ' + studentDetailsArr[student].studentName + ', ';
      }
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
        if (userData) {

          let participantName;
          let lectureUrl;
          if (participant.userType === 1) {
            participantName = (userData as Student).studentFamilyName + ' ' + (userData as Student).studentName;
            lectureUrl = `${process.env.lectureBaseUrl}/classroom/student/${participant.lectureUrl}`
          } else {
            participantName = (userData as Tutor).tutorFamilyName + ' ' + (userData as Tutor).tutorFirstName;
            lectureUrl = `${process.env.lectureBaseUrl}/classroom/teacher/${participant.lectureUrl}`
          }

          let dynamic_template_data = {
            url: lectureUrl,
            date: lectureStartTime,
            teacherflag: (participant.userType === 0) ? true : false,
            teacher: tutorName,
            student: studentListStr,
            receiver: participantName,
          };
          if (userData.email && !userData.email.includes('@smartclass.jp')) {
            // fetch the value fro AWS SSM
            const sendGridLectureKey = await sendGridLecturePromise;
            let emailSentResult = await sender.sendEmailBySendGrid(
              [userData.email],
              sendGridLectureKey.Parameter!.Value,
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
    const adminId = event.requestContext.identity.cognitoIdentityId!.replace(process.env.REGION + ':', '');
    if (!adminId) {
      const err = new Error(`invalid adminId `);
      statusCode = 400;
      throw err;
    }
    // validate the input data
    const body = event.body ? JSON.parse(event.body) : {};
    if (!body.userId || !body.lectureId) {
      const err = new Error(`invalid parameters`);
      statusCode = 400;
      throw err;
    }
    const result = await resendEmail(body.userId, body.lectureId, adminId);
    return success(result);
  } catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
