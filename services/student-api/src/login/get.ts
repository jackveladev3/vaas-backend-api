import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../libs/response-lib.js';


//# Method for fetching data from student table
export async function fetchStudentInfo(
    studentId: string = ' ',
    enterpriseId: string = ' ',
    adminId: string = ' ',
    requestType: string,
    flag: number = 0 // 0 meas implicit return result with success or 1 means just only return result
) {
    let params = {};
    if (requestType === 'get') {
        params = {
            TableName: 'students',
            KeyConditionExpression: 'studentId = :studentId',
            ExpressionAttributeValues: {
                ':studentId': studentId
            }
        };
        try {
            const result = await dynamoDb.query(params);
            let resp = result.Items[0];
            if (resp.email.includes('@smartclass.jp') && flag !== 1) resp.email = "";
            return (flag === 0) ? success(resp) : resp;
        }
        catch (e) {
            console.log('fetchStudentInfo -> e', e);
            return (flag === 0) ? failure({ status: false }) : { message: 'student not found' };
        }
    } else {
        const params = {
            TableName: 'students',
            IndexName: 'enterpriseId-adminId-index',
            KeyConditionExpression: 'enterpriseId = :enterpriseId and adminId = :adminId',
            ExpressionAttributeValues: {
                ':enterpriseId': enterpriseId,
                ':adminId': adminId
            }
        };
        try {
            let result: any = [];
            result = await dynamoDb.query(params);
            if (result && result.Items) {
                for (let student of result.Items) {
                    if (student.email.includes('@smartclass.jp')) student.email = "";
                }
            }
            return (flag === 0) ? success(result) : result;
        } catch (error) {
            console.log('fetchStudentInfo -> error', error);
            return (flag === 0) ? failure({ status: false }) : { message: 'students not found' };
        }
    }
}

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    try {
        const body = event.body ? JSON.parse(event.body) : {};
        const studentId = (event.pathParameters?.studentId) ? event.pathParameters?.studentId.toString() : '';
        const enterpriseId = (event.pathParameters?.enterpriseId) ? event.pathParameters?.enterpriseId.toString() : '';
        if (!enterpriseId || enterpriseId === '') {
            const err = new Error(`invalid pathParameters (${body.type}).`);
            statusCode = 400;
            throw err;
        }
        const adminId = event.requestContext.identity.cognitoIdentityId!.replace(
            process.env.REGION + ':',
            ''
        );
        if (!adminId) {
            const err = new Error(`invalid adminId `);
            statusCode = 400;
            throw err;
        }
        const requestType = (studentId !== '') ? 'get' : 'getAll';
        const result = await fetchStudentInfo(studentId, enterpriseId, adminId, requestType);

        // Return the retrieved item
        if (result.body) {
            let resultBody = JSON.parse(result.body);
            if (requestType === 'get') return success(JSON.parse(result.body));
            else return success(resultBody.Items);
        }
        else {
            failure({ status: false, error: 'Item not found.' }); // Return with error
        }

    } catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
