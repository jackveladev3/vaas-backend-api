import { Context, APIGatewayEvent } from 'aws-lambda';
import { success, } from '../../../../../libs/response-lib.js';
import { fetchTutorInfo } from '../../../../tutor-api/src/login/get';
import { fetchStudentInfo } from '../../../../student-api/src/login/get';

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    try {
        event.body ? JSON.parse(event.body) : {};
        const adminId = event.requestContext.identity.cognitoIdentityId!.replace(
            process.env.REGION + ':',
            ''
        );
        if (!adminId) {
            const err = new Error(`invalid adminId `);
            statusCode = 400;
            throw err;
          }
        const enterpriseId = event.queryStringParameters!.enterpriseId.toString();
        let userList: any = [];
        const tutorDetails = await fetchTutorInfo(' ', adminId, enterpriseId, 'getAll', 1);
        const studentDetails = await fetchStudentInfo(' ', enterpriseId, adminId, 'getAll', 1);
        if (tutorDetails.Items && tutorDetails.Items.length > 0) userList = Object.assign([], tutorDetails.Items);
        if (studentDetails.Items && studentDetails.Items.length > 0) userList = userList.concat(studentDetails.Items);
        return success(userList);
    }
    catch (error) {
        console.log('error', error);
        return error(statusCode, JSON.parse(event.body!));
    }
}