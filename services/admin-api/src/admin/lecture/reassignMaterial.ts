import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';

async function reassignMaterial(
  userId: string,
  lectureId: string,
  workBooks: string
) {
  /// fetch material assign with users
  const params = {
    TableName: 'participants',
    Key: {
      lectureId,
      userId
    },
  };
  try {
    const results = await dynamoDb.get(params);
    if (results.Item && Object.keys(results.Item).length > 0) {
      const params = {
        TableName: 'participants',
        Key: {
          lectureId,
          userId
        },
        UpdateExpression: 'SET workbooks = :workbooks',
        ExpressionAttributeValues: {
          ':workbooks': workBooks,
        },
        ReturnValues: 'ALL_NEW',
      };

      try {
        const result = await dynamoDb.update(params);
        return {
          message: 'material updated successfully ',
          data: result.Attributes
        };
      }
      catch (e) {
        console.log('reassignMaterial -> error', e);
        return {
          message: 'Oops some error while updating material!',
          data: {}
        };
      }
    }
  }
  catch (error) {
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
    // validate the input data
    const body = event.body ? JSON.parse(event.body) : {};
    if (!body.userId || !body.lectureId || !body.workbooks) {
      const err = new Error(`invalid parameters`);
      statusCode = 400;
      throw err;
    }
    const result = await reassignMaterial(
      body.userId,
      body.lectureId,
      body.workbooks
    );
    return success(result);
  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
