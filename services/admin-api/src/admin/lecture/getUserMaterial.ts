import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';

async function fetchMaterialByUserId(userId: string, lectureId: string) {
  /// fetch material assign with users
  const params = {
    TableName: 'participants',
    Key: {
      lectureId: lectureId,
      userId: userId,
    },
  };
  try {
    const results = await dynamoDb.get(params);
    if (results.Item && Object.keys(results.Item).length > 0) {
      return {
        workbooks: results.Item.workbooks,
        uploaded: results.Item.uploaded,
      };
    } else {
      return { message: 'No Lecture Or User Found' };
    }
  } catch (error) {
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
    //validate the input data
    if (event.pathParameters!.userId.toString() === 'null') {
      const err = new Error(`invalid pathParameters `);
      statusCode = 400;
      throw err;
    }
    const result = await fetchMaterialByUserId(event.pathParameters!.userId, event.pathParameters!.lectureId);
    return success(result);
  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
