import * as AWS from 'aws-sdk';
import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { Lecture } from '../../model/lecture';
import * as uuid from 'uuid';
import utils from '../../../../../libs/util.js';
import sender from '../../../../../libs/sender.js';
import config from '../../../../../config.js';
import * as moment from 'moment';


// Load our secret key from SSM
const ssm = new AWS.SSM();
const sendGridLecturePromise = ssm.getParameter({
  Name: config.sendGridLectureUrl,
  WithDecryption: true,
}).promise();

//# Method for create lecture in lecture table
async function createLecture(
  _: APIGatewayEvent,
  adminId: string,
  body: Lecture
) {
  const params = {
    TableName: 'lectures',
    Item: {
      lectureId: uuid.v1(),
      enterpriseId: body.enterpriseId,
      adminId: adminId,
      length: body.length,
      lectureDate: body.lectureDate,
      startTime: body.startTime,
      endTime: body.endTime,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      deletedDate: null,
    },
  };
  try {
    await dynamoDb.put(params);
    return success(params.Item);
  } catch (error) {
    console.log('error', error);
    return failure({ status: false });
  }
}

//# Method for create lecture material in lecture table
async function createLectureMaterial(
  userType = 1,
  body: any,
  lectureId,
  i,
  emailSent = 0
) {
  let arrayToInsert: any = [];
  let userIdArray = userType === 1 ? body.students : body.tutors;
  for (let j = i * 100; j >= i * 100 && j < (i + 1) * 100 && j < userIdArray.length; j++) {
    let lectureMaterial: any = {
      lectureId: lectureId,
      userId: userIdArray[j].id,
      userType: userType,
      emailSent: emailSent,
      workbooks: userIdArray[j].workbooks,
      uploaded: [],
      standby: false,
      joined: false,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      deletedDate: null,
      lectureUrl: userIdArray[j].lectureUrlUniqueId,
      whiteboardImgs: []
    };
    arrayToInsert.push({
      PutRequest: {
        Item: lectureMaterial,
      },
    });
  }

  if (!arrayToInsert.length) return true;

  let params = {
    RequestItems: {
      'smartclass-dev-participants': arrayToInsert,
    },
  };

  await dynamoDb.batchWrite(params);
  if (i < Math.floor(userIdArray.length / 100)) {
    return await createLectureMaterial(userType, body, lectureId, i + 1, emailSent);
  } else {
    return true;
  }
}

async function createLectureMaterialTutor(lectureMaterialInfo: any) {
  const params = {
    TableName: 'participants',
    Item: lectureMaterialInfo,
  };

  let result = await dynamoDb.put(params);
  return result;
}

export async function main(event: APIGatewayEvent, _: Context) {
  let statusCode = 0;
  try {
    const adminId = event.requestContext.identity.cognitoIdentityId!.replace(
      process.env.REGION + ':',
      ''
    );
    if (!adminId) {
      const err = new Error(`invalid adminId `);
      statusCode = 400;
      throw err;
    }
    const body = event.body ? JSON.parse(event.body) : {};
    // const enterpriseId = body.enterpriseId;

    // Set lecture length and lecture date time
    let startTime = body.startTime;
    let endTime = body.endTime;
    let lectureDateArray = startTime.split(' ');
    let lectureDate = lectureDateArray[0];
    body.lectureDate = lectureDate;

    let startTimeMoment = moment(startTime, 'YYYY-MM-DD hh:mm:ss A');
    let endTimeMoment = moment(endTime, 'YYYY-MM-DD hh:mm:ss A');
    let timeDiff = endTimeMoment.diff(startTimeMoment, 'minutes');
    let lectureLength = (~~(timeDiff / 60)).toString();
    lectureLength = lectureLength + ' hour ' + (timeDiff % 60) + 'minutes';
    body.length = lectureLength;
    // ==========================================

    const result = await createLecture(event, adminId, body);
    if (result.body) {

      let lectureDetails: any = JSON.parse(result.body);
      let lectureId = lectureDetails.lectureId;

      let studentIdArray: any = [];

      // register students
      let students: any = body.students;
      for (let student of students) {
        studentIdArray.push(student.id);
      }
      // =================

      // create lecture material for students
      let studentInfoResult: any = await utils.getStudents({}, studentIdArray, 0);
      let studentListStr = '';
      for (let stu of studentIdArray) {
        studentListStr += studentInfoResult[stu].studentFamilyName + ' ' + studentInfoResult[stu].studentName + ', ';
      }

      const messageArr: any = [];
      let tutorInfoResult: any = {};
      let tutorInfo: any = {};
      let tutorId;
      tutorId = body.tutor;
      tutorInfoResult = await utils.getTutor(tutorId);
      tutorInfo = tutorInfoResult.Items[0];

      // let tutorInfo = tutorInfoResult.Items[0];
      let lectureUrlUniqueId = await utils.getUniqueId();
      let lectureUrl = `${process.env.lectureBaseUrl}/classroom/teacher/${lectureUrlUniqueId}`;
      tutorInfoResult.lectureUrl = lectureUrl;
      tutorInfoResult.lectureUrlUniqueId = lectureUrlUniqueId;
      const sendGridLectureKey = await sendGridLecturePromise;

      let tutorName = tutorInfo.tutorFamilyName + ' ' + tutorInfo.tutorFirstName;
      let dynamic_template_data = {
        url: lectureUrl,
        date: startTime,
        teacherflag: true,
        teacher: tutorName,
        student: studentListStr,
        receiver: tutorName,
      };

      messageArr.push({
        to: tutorInfo.email,
        from: 'スマートクラス <no-reply@smartclass.jp>',
        templateId: sendGridLectureKey.Parameter!.Value,
        dynamic_template_data
      });
      // ================

      // email for students
      let x = 0;
      for (let student of studentIdArray) {
        let lectureUrlUniqueId = await utils.getUniqueId();
        let lectureUrl = `${process.env.lectureBaseUrl}/classroom/student/${lectureUrlUniqueId}`;
        let studentName = studentInfoResult[student].studentFamilyName + ' ' + studentInfoResult[student].studentName;
        let dynamic_template_data = {
          url: lectureUrl,
          date: startTime,
          teacherflag: false,
          teacher: tutorName,
          student: studentName,
          receiver: studentName,
        };

        body.students[x].lectureUrlUniqueId = lectureUrlUniqueId;
        body.students[x].lectureUrl = lectureUrl;
        body.students[x].email = studentInfoResult[student].email;

        if (studentInfoResult[student].email) {
          messageArr.push({
            to: studentInfoResult[student].email,
            from: 'スマートクラス <no-reply@smartclass.jp>',
            templateId: sendGridLectureKey.Parameter!.Value,
            dynamic_template_data,
          });
        }
        x += 1;
      }
      // ==================

      let emailSentResult = await sender.sendMultipleEmailBySendGrid(
        messageArr
      );

      console.log('===email sent result@@@', emailSentResult);
      // set email is sent or not
      if (emailSentResult) {
        for (let student of body.students) {
          console.log('===student.email===@@@', student.email);
          if (student.email.includes('@smartclass.jp')) student.emailSent = 0;
          else student.emailSent = 1;
        }
      }
      // =========================

      // create lecture for student
      await createLectureMaterial(1, body, lectureDetails.lectureId, 0, emailSentResult);

      // create lecture material for tutor
      let lectureMaterial: any = {
        lectureId: lectureId,
        userId: tutorId,
        lectureUrl: tutorInfoResult.lectureUrlUniqueId,
        userType: 0,
        emailSent: emailSentResult,
        uploaded: [],
        standby: false,
        joined: false,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        deletedDate: null,
        whiteboardImgs: []
      };



      await createLectureMaterialTutor(lectureMaterial);

      // ================================
      let tutorEmail = tutorInfoResult.Items[0].email;
      if (tutorEmail.includes('@smartclass.jp')) lectureDetails.tutorEmailSent = 0;
      else lectureDetails.tutorEmailSent = emailSentResult;

      lectureDetails.students = body.students;
      lectureDetails.tutor = body.tutor;
      lectureDetails.tutorEmail = tutorInfoResult.Items[0].email;
      lectureDetails.tutorLectureUrl = tutorInfoResult.lectureUrl;


      return success(lectureDetails);
    } else {
      // Return with error
      return failure({ status: false, error: 'Item not found.' });
    }
  } catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
