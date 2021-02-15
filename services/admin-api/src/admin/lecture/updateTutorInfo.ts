import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { cognitoAction } from '../../../../../libs/cognito';
import { fetchStudentBasedOnEmail } from "../../../../student-api/src/login/login";
import { Student } from '../../../../student-api/src/model/student';


async function fetchTutorBasedOnEmail(email: string, tutorId: string, type: Number = 0) {
    let params = type === 0 ? {
        TableName: 'tutors',
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        FilterExpression: 'tutorId <> :tutorId',
        ExpressionAttributeValues: {
            ':email': email,
            ':tutorId': tutorId
        }
    } : {
            TableName: 'tutors',
            KeyConditionExpression: 'tutorId = :tutorId',
            ExpressionAttributeValues: {
                ':tutorId': tutorId
            }
        };
    try {
        const result = await dynamoDb.query(params);
        return result;
    }
    catch (e) {
        console.log("fetchTutorBasedOnEmail -> e", e);
        return { message: 'tutor not found' };
    }
}

async function updateUserInDatabase(userInfo) {

    // update user into database
    const params = {
        TableName: "tutors",
        Key: {
            tutorId: userInfo.tutorId
        },
        UpdateExpression: "SET tutorFirstName = :tutorFirstName, tutorFamilyName = :tutorFamilyName, email = :email, memo = :memo, updatedDate =:updatedDate",
        ExpressionAttributeValues: {
            ":tutorFirstName": userInfo.tutorFirstName,
            ":tutorFamilyName": userInfo.tutorFamilyName,
            ":email": userInfo.email,
            ":memo": userInfo.memo,
            ":updatedDate": new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
    };
    try {
        const promise = new Promise(async (resolve, reject) => {
            // fetching the old email     
            let tutorSearchDetails: any = await fetchTutorBasedOnEmail(userInfo.email, userInfo.tutorId, 1);
            if (tutorSearchDetails.Items[0].email !== userInfo.email) {
                // need to check this user is not registered with student
                let students: [Student] = await fetchStudentBasedOnEmail(tutorSearchDetails.Items[0].email);
                console.log("🚀 ~ file: updateTutorInfo.ts ~ line 61 ~ promise ~ students", students, students.length > 0);
                if (students.length > 0) {
                    // this updated email is already registered with student
                    reject('电子邮件已经向学生注册，请尝试其他电子邮...');
                }
                else if (!students.length) {
                    let result = await dynamoDb.update(params);
                    let cUsrInfo = {
                        email: tutorSearchDetails.Items[0].email,
                        password: tutorSearchDetails.Items[0].password,
                        newEmail: userInfo.email
                    }
                    await cognitoAction(0, cUsrInfo, 'updateUser', (_) => {
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
        console.log("🚀 ~ file: updateTutorInfo.ts ~ line 84 ~ updateUserInDatabase ~ result", result)
        return result;
    } catch (e) {
        console.log("updateUserInDatabase -> e", e);
        return failure({ status: false, error:  e });
    }
}

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        let tutorInfo: any = {
            email: body.email,
            tutorFamilyName: body.tutorFamilyName,
            tutorId: body.tutorId,
            tutorFirstName: body.tutorFirstName,
            memo: body.memo
        };
        let tutorSearchDetails: any = await fetchTutorBasedOnEmail(tutorInfo.email, tutorInfo.tutorId);
        console.log("🚀 ~ file: updateTutorInfo.ts ~ line 89 ~ main ~ tutorSearchDetails", tutorSearchDetails);
        if (tutorSearchDetails.Items.length > 0) {
            return error(statusCode, 'Email already registered!');
        } else {
            let result: any = await updateUserInDatabase(tutorInfo);
            if (result.Attributes) return success(result.Attributes);
            else return failure(result);
        }
    } catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
