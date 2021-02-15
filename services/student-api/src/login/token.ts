import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../libs/response-lib.js';
import { LectureMaterial } from '../../../admin-api/src/model/lectureMaterial';
import { fetchStudentInfo } from '../login/get';
import { cognitoAction } from "../../../../libs/cognito.js"

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
        const promise = new Promise(async (resolve, _) => {
            const params = {
                TableName: 'participants',
                IndexName: 'lectureUrl-createdDate-index',
                KeyConditionExpression: 'lectureUrl = :lectureUrl',
                ExpressionAttributeValues: {
                    ':lectureUrl': event.pathParameters!.lectureURLId.toString()
                }
            };
            try {
                const results = await dynamoDb.query(params);
                // console.log("fetchLectureById -> results", results, event.pathParameters!.lectureURLId.toString());
                let event: LectureMaterial = results.Items ? results.Items[0] : null;
                if (event) {
                    //now fetching the user information
                    const studentDetails = await fetchStudentInfo(event.userId, ' ', ' ', 'get', 1);
                    let userInfo = { email: studentDetails.email, password: studentDetails.password }
                    cognitoAction(1, userInfo, "login", (token) => {
                        resolve({ "jwtToken": token });
                    });
                } else {
                    resolve({ "message": 'No Lecture Found' });
                }
            }
            catch (error) {
                console.log('error', error);
                return failure(error);
            }
        });
        let token = await promise;
        console.log("main -> res", token);
        return success(token);

    } catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
