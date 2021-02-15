import * as AWS from 'aws-sdk';
import { Context, APIGatewayEvent } from 'aws-lambda';
import * as moment from 'moment';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { Lecture } from '../../model/lecture';
import utils from '../../../../../libs/util.js';
import sender from '../../../../../libs/sender.js';
import config from '../../../../../config.js';
import { fetchData } from './getLectures';

// Load our secret key from SSM
const ssm = new AWS.SSM();
const sendGridUpdateLecturePromise = ssm
  .getParameter({
    Name: config.sendGridUpdateLectureUrl,
    WithDecryption: true,
  })
  .promise();

const sendGridAddStudentPromise = ssm
  .getParameter({
    Name: config.sendGridAddStudentLectureUrl,
    WithDecryption: true,
  })
  .promise();

//# Method for update lecture in lecture table
async function updateLecture(
  _: APIGatewayEvent,
  adminId: string,
  body: Lecture
) {
  const params = {
    TableName: 'lectures',
    Item: {
      lectureId: body.lectureId,
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

async function updateLectureMaterial(
  userType = 1,
  body: any,
  lectureId,
  i,
  emailSent = 0
) {
  let users = userType === 1 ? body.students : body.tutors;
  let count = 0;
  for (let j = 0; j < users.length; j++) {
    const params = {
      TableName: 'participants',
      Item: {
        lectureId: lectureId,
        userId: users[j].id,
        userType: userType,
        emailSent: emailSent,
        workbooks: users[j].workbooks,
        uploaded: [],
        standby: false,
        joined: false,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        deletedDate: null,
        lectureUrl: users[i].lectureUrlUniqueId,
        whiteboardImgs: []
      },
    };

    try {
      await dynamoDb.put(params);
      count += 1;
    } catch (error) {
      console.log('error', error);
    }
  }
  if (count === users.length) return 1;
  else return 0;
}

async function updateLectureMaterialTutor(lectureMaterialInfo: any) {
  const params = {
    TableName: 'participants',
    Item: lectureMaterialInfo,
  };

  let result = await dynamoDb.put(params);
  return result;
}

async function deleteLectureMaterial(keys: any) {
  const params = {
    TableName: 'participants',
    Key: keys,
  };

  let result = await dynamoDb.delete(params);
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
    body.enterpriseId;

    let contentUpdated = body.contentUpdated;
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

    const result = await updateLecture(event, adminId, body);
    if (result.body) {
      // let tutorId = body.tutor;
      let lectureDetails: any = JSON.parse(result.body);
      let lectureId = lectureDetails.lectureId;
      let oldParticipants: any = await fetchData(lectureId, lectureDetails.adminId);
      let students = body.students;

      let studentIdArray: any = [];
      for (let student of students) {
        studentIdArray.push(student.id);
      }


      let studentInfoResult: any = await utils.getStudents(
        {},
        studentIdArray,
        0
      );

      // comparing oldParticipant with new student array
      let newStudents: any = [];
      let newStudentsStr: string = '';
      for (let student of students) {
        let found = false;
        for (let oldPart of oldParticipants) {
          if (student.id.trim() === oldPart.userId.trim()) {
            found = true;
          }
        }
        if (!found) {
          newStudents.push(student);
          newStudentsStr += studentInfoResult[student.id].studentFamilyName + ' ' + studentInfoResult[student.id].studentName + ', ';
        }
      }
      // ===============================================

      // create lecture material for students
      let studentListStr = '';
      for (let stu of studentIdArray) {
        studentListStr +=
          studentInfoResult[stu].studentFamilyName +
          ' ' +
          studentInfoResult[stu].studentName +
          ', ';
      }

      const messageArr: any = [];
      let tutorInfoResult: any = {};
      // let tutorInfo: any;
      let tutorId;
      tutorId = body.tutor;
      tutorInfoResult = await utils.getTutor(tutorId);
      // let tutorInfo: any = tutorInfoResult.Items[0];
      // console.log('===tutor info====', tutorInfo);


      // if content is updated then only we will send invitation means
      // it is hit from next screen of the modal
      let emailSentResult = 0;
      if (contentUpdated && newStudents.length == 0) {
        let lectureUrlUniqueId = await utils.getUniqueId();
        let lectureUrl = `${process.env.lectureBaseUrl}/classroom/teacher/${lectureUrlUniqueId}`;
        tutorInfoResult.lectureUrl = lectureUrl;
        tutorInfoResult.lectureUrlUniqueId = lectureUrlUniqueId;
        const sendGridUpdateLectureKey = await sendGridUpdateLecturePromise;

        let tutorName = tutorInfoResult.Items[0].tutorFamilyName + ' ' + tutorInfoResult.Items[0].tutorFirstName;
        // email for tutor
        let dynamic_template_data = {
          url: lectureUrl,
          date: startTime,
          teacherflag: true,
          teacher: tutorName,
          student: studentListStr,
          receiver: tutorName,
        };

        messageArr.push({
          to: tutorInfoResult.Items[0].email,
          from: 'スマートクラス <no-reply@smartclass.jp>',
          templateId: sendGridUpdateLectureKey.Parameter!.Value,
          dynamic_template_data,
        });
        // ================

        // email for students
        let x = 0;
        for (let student of studentIdArray) {
          let lectureUrlUniqueId = await utils.getUniqueId();
          let lectureUrl = `${process.env.lectureBaseUrl}/classroom/student/${lectureUrlUniqueId}`;
          let studenrName = studentInfoResult[student].studentFamilyName + ' ' + studentInfoResult[student].studentName;

          let dynamic_template_data = {
            url: lectureUrl,
            date: startTime,
            teacherflag: false,
            teacher: tutorName,
            student: studenrName,
            receiver: studenrName,
          };
          body.students[x].lectureUrlUniqueId = lectureUrlUniqueId;
          body.students[x].lectureUrl = lectureUrl;
          body.students[x].email = studentInfoResult[student].email;
          if (studentInfoResult[student].email) {
            messageArr.push({
              to: studentInfoResult[student].email,
              from: 'スマートクラス <no-reply@smartclass.jp>',
              templateId: sendGridUpdateLectureKey.Parameter!.Value,
              dynamic_template_data,
            });
          }
          x += 1;
        }
        // ==================

        await sender.sendMultipleEmailBySendGrid(messageArr);
        // console.log('====emailSentResult=====', emailSentResult);
      } else if (newStudents.length > 0) {
        // when new students added content is not updated then use template 4
        let lectureUrlUniqueId = await utils.getUniqueId();
        let lectureUrl = `${process.env.lectureBaseUrl}/classroom/teacher/${lectureUrlUniqueId}`;
        tutorInfoResult.lectureUrl = lectureUrl;
        tutorInfoResult.lectureUrlUniqueId = lectureUrlUniqueId;
        const sendGridAddStudentLectureKey = await sendGridAddStudentPromise;

        let tutorName = tutorInfoResult.Items[0].tutorFamilyName + ' ' + tutorInfoResult.Items[0].tutorFirstName;
        // email for tutor
        let dynamic_template_data = {
          url: lectureUrl,
          date: startTime,
          teacherflag: true,
          teacher: tutorName,
          student: newStudentsStr,
          receiver: tutorName,
        };

        messageArr.push({
          to: tutorInfoResult.Items[0].email,
          from: 'スマートクラス <no-reply@smartclass.jp>',
          templateId: sendGridAddStudentLectureKey.Parameter!.Value,
          dynamic_template_data,
        });
        // ================

        await sender.sendMultipleEmailBySendGrid(messageArr);
        // console.log('====emailSentResult=====', emailSentResult);
      }

      // create lecture for student
      await updateLectureMaterial(
        1,
        body,
        lectureDetails.lectureId,
        0,
        emailSentResult
      );

      if (tutorId !== undefined && tutorId !== '') {
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

        await updateLectureMaterialTutor(lectureMaterial);
        // ================================
      }

      // Delete old students and tutor from participant table
      if (body.oldTutor !== undefined && body.oldTutor !== '') {
        let keys = {
          lectureId,
          userId: body.oldTutor,
        };
        await deleteLectureMaterial(keys);

        let oldStudents = body.oldStudents;
        for (let student of oldStudents) {
          let keys = {
            lectureId,
            userId: student,
          };
          await deleteLectureMaterial(keys);
        }
      }
      //=====================================================

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
