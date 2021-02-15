import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { cognitoAction } from '../../../../../libs/cognito';
import { fetchTutorBasedOnEmail } from "../../../../tutor-api/src/login/login";
import { Tutor } from '../../../../tutor-api/src/model/tutor';

async function fetchStudentBasedOnEmail(email: string, studentId: string, type: Number = 0) {
    let params = type === 0 ? {
        TableName: 'students',
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        FilterExpression: 'studentId <> :studentId',
        ExpressionAttributeValues: {
            ':email': email,
            ':studentId': studentId
        }
    } : {
            TableName: 'students',
            KeyConditionExpression: 'studentId = :studentId',
            ExpressionAttributeValues: {
                ':studentId': studentId
            }
        };
    try {
        const result = await dynamoDb.query(params);
        return result;
    }
    catch (e) {
        console.log("fetchStudentBasedOnEmail -> e", e);
        return { message: 'student not found' };
    }
}

async function updateUserInDatabase(userInfo) {

    // update user into database
    const params = {
        TableName: "students",
        Key: {
            studentId: userInfo.studentId
        },
        UpdateExpression: "SET studentName = :studentName, studentFamilyName = :studentFamilyName, email = :email, memo = :memo, updatedDate =:updatedDate",
        ExpressionAttributeValues: {
            ":studentName": userInfo.studentName,
            ":studentFamilyName": userInfo.studentFamilyName,
            ":email": userInfo.email,
            ":memo": userInfo.memo,
            ":updatedDate": new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
    };
    try {
        const promise = new Promise(async (resolve, reject) => {
            // fetching the old email     
            let studentSearchDetails: any = await fetchStudentBasedOnEmail(userInfo.email, userInfo.studentId, 1);
            if (studentSearchDetails.Items[0].email !== userInfo.email) {
                // need to check this user is not registered with tutor
                let tutors: [Tutor] = await fetchTutorBasedOnEmail(studentSearchDetails.Items[0].email);
                if (tutors.length > 0) {
                    // this updated email is already registered with student
                    reject('电子邮件已经在辅导老师处注册，请尝试其他...');
                }
                else if (!tutors.length) {
                    let result = await dynamoDb.update(params);
                    let cUsrInfo = {
                        email: studentSearchDetails.Items[0].email,
                        password: studentSearchDetails.Items[0].password,
                        newEmail: userInfo.email
                    }
                    await cognitoAction(1, cUsrInfo, 'updateUser', (_) => {
                        resolve(result);
                    });
                }              
            }
            else {
                let result = await dynamoDb.update(params);
                resolve(result);
            }
        });
        let result = await promise;
        return result;
    } catch (e) {
        return failure({ status: false, error:  e });
    }
}

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        let studentInfo: any = {
            email: body.email,
            studentFamilyName: body.studentFamilyName,
            studentId: body.studentId,
            studentName: body.studentName,
            memo: body.memo
        };
        let studentSearchDetails: any = await fetchStudentBasedOnEmail(studentInfo.email, studentInfo.studentId);
        if (studentSearchDetails.Items.length > 0) {
            return error(statusCode, 'Email already registered!');
        } else {
            let result: any = await updateUserInDatabase(studentInfo);
            if (result.Attributes) return success(result.Attributes);
            else return failure(result);
        }
    } catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}

