import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../libs/response-lib.js';

//# Method for fetching data from Tutor table
export async function fetchTutorInfo(
    // _: APIGatewayEvent,
    tutorId: string,
    adminId: string = ' ',
    enterpriseId: string = ' ',
    requestType: string,
    flag: number = 0
) {
    if (requestType === 'get') {
        const params = {
            TableName: 'tutors',
            KeyConditionExpression: 'tutorId = :tutorId',
            ExpressionAttributeValues: {
                ':tutorId': tutorId
            },
        };
        try {
            const result = await dynamoDb.query(params);
            return (flag === 0) ? success(result.Items[0]) : result.Items[0];
        }
        catch (error) {
            console.log('fetchTutorInfo test -> error', error);
            return (flag === 0) ? failure({ status: false }) : { message: 'student not found' };
        }
    } else {
        const params = {
            TableName: 'tutors',
            IndexName: 'enterpriseId-adminId-index',
            KeyConditionExpression: 'enterpriseId = :enterpriseId and adminId = :adminId',
            ExpressionAttributeValues: {
                ':enterpriseId': enterpriseId,
                ':adminId': adminId
            }
        };
        try {
            const result = await dynamoDb.query(params);
            return (flag === 0) ? success(result) : result;
        }
        catch (error) {
            console.log('fetchTutorInfo -> error', error);
            return (flag === 0) ? failure({ status: false }) : { message: 'students not found' };
        }
    }
}

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    try {
        const tutorId = (event.pathParameters?.tutorId) ? event.pathParameters!.tutorId.toString() : '';
        const enterpriseId = (event.pathParameters?.enterpriseId) ? event.pathParameters?.enterpriseId.toString() : '';
        if (!enterpriseId || enterpriseId === '') {
            const err = new Error(`invalid path params.`);
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

        const requestType = (tutorId !== '') ? 'get' : 'getAll';
        const result = await fetchTutorInfo(tutorId, adminId, enterpriseId, requestType);

        // Return the retrieved item
        if (result.body) {
            let resultBody = JSON.parse(result.body);
            if (requestType === 'get') return success(JSON.parse(result.body));
            else return success(resultBody.Items);
        }
        else {
            failure({ status: false, error: 'Item not found.' }); // Return with error
        }
    }
    catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
