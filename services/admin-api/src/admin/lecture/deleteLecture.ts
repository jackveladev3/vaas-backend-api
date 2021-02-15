import * as AWS from 'aws-sdk';
import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { fetchData } from '../lecture/getLectures';
import config from '../../../../../config.js';
import utils from '../../../../../libs/util.js';
import sender from '../../../../../libs/sender.js';


const ssm = new AWS.SSM();
const sendGridLecturePromise = ssm.getParameter({
    Name: config.sendGridDeleteLectureUrl,
    WithDecryption: true,
}).promise();

async function setDeleteDate(uploadedArray: any = [], i = 0) {


    let arrayToInsert: any = [];
    // for (let uploadObj of uploadedArray) {
    for (
        let j = i * 25;
        j >= i * 25 && j < (i + 1) * 25 && j < uploadedArray.length;
        j++
    ) {
        let uploadObject: any = {
            uploadId: uploadedArray[j].uploadId,
            lectureId: uploadedArray[j].lectureId,
            userId: uploadedArray[j].userId,
            uploaderId: uploadedArray[j].uploaderId,
            uploaderType: uploadedArray[j].uploaderType,
            deletedDate: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
            createdDate: uploadedArray[j].createdDate,
        }
        arrayToInsert.push({
            PutRequest: {
                Item: uploadObject
            },
        });
    }
    let UploadParams = {
        RequestItems: {
            'smartclass-dev-uploads': arrayToInsert,
        },
    };

    await dynamoDb.batchWrite(UploadParams);
    if (i < Math.floor(uploadedArray.length / 25)) {
        return await setDeleteDate(uploadedArray, i + 1);
    } else {
        return "success";
    }

    // return (result) ? "success" : "error";
}

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    try {
        const adminId = event.requestContext.identity.cognitoIdentityId!.replace(process.env.REGION + ':', '');
        const body = event.body ? JSON.parse(event.body) : {};
        let lectureId = body.lectureId;

        let params = {
            TableName: 'lectures',
            Key: {
                lectureId,
                adminId
            },
            UpdateExpression: 'set deletedDate = :deletedDate',
            ExpressionAttributeValues: {
                ':deletedDate': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };
        let result = await dynamoDb.update(params);
        if (result.Attributes) {

            // delete uploaded images
            let params = {
                TableName: 'uploads',
                IndexName: 'lectureId-index',
                KeyConditionExpression: 'lectureId = :lectureId',
                ExpressionAttributeValues: {
                    ':lectureId': lectureId
                }
            }
            const uploadsRes = await dynamoDb.query(params);
            let uploadedArray: any = [];
            if (uploadsRes && uploadsRes.Items) uploadedArray = uploadsRes.Items;
            if (uploadedArray.length > 0) await setDeleteDate(uploadedArray, 0);
            // ======================

            // get lecture
            let participants = await fetchData(lectureId, adminId);
            let startTime = result.Attributes.startTime;
            const sendGridLectureKey = await sendGridLecturePromise;
            let studentIdArray: any = [];
            let tutorId: string = ''
            let lectureUrlUniqueId: string = ''
            for (let parti of participants) {
                lectureUrlUniqueId = parti.lectureUrl;
                if (parti.userType) {
                    studentIdArray.push(parti.userId);
                } else {
                    tutorId = parti.userId
                }
            }
            let studentListStr = '';
            let studentInfoResult: any = await utils.getStudents({}, studentIdArray, 0);
            for (let i = 0; i < studentInfoResult.length; i++) {
                studentListStr = studentListStr + studentInfoResult[studentInfoResult[i].id].studentName + ' ' + studentInfoResult[studentInfoResult[i].id].studentFamilyName + ',';
            }
            let tutorInfoResult: any = await utils.getTutor(tutorId);
            const messageArr: any = [];
            let tutorName = tutorInfoResult.Items[0].tutorFamilyName + ' ' + tutorInfoResult.Items[0].tutorFirstName;
            let lectureUrl = `${process.env.lectureBaseUrl}/waiting-room/${lectureUrlUniqueId}`;

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
                templateId: sendGridLectureKey.Parameter!.Value,
                dynamic_template_data
            });
            // ================
            for (let student of studentIdArray) {
                let studentName = studentInfoResult[student].studentFamilyName + ' ' + studentInfoResult[student].studentName;
                let dynamic_template_data = {
                    url: lectureUrl,
                    date: startTime,
                    teacherflag: false,
                    teacher: tutorName,
                    student: studentName,
                    receiver: studentName,
                };
                if (studentInfoResult[student].email) {
                    messageArr.push({
                        to: studentInfoResult[student].email,
                        from: 'スマートクラス <no-reply@smartclass.jp>',
                        templateId: sendGridLectureKey.Parameter!.Value,
                        dynamic_template_data,
                    });
                }
            }

            await sender.sendMultipleEmailBySendGrid(
                messageArr
            );
            return success({ message: 'success' });
        } else {
            return failure(result);
        }

    }
    catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
