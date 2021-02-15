import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';
import { Admin } from '../../model/admin';

//# Method for fetching data from admin table
export async function fetchAdminInfo(
  _1: string,
  adminId: string,
  flag: number /// 0 means return result or 1 means not returns it
) {
  // fetch the data from participants table
  const params = {
    TableName: 'admin',
    KeyConditionExpression: 'adminId = :adminId',
    IndexName: 'adminId-index',
    ExpressionAttributeValues: {
      ':adminId': adminId,
    },
  };

  try {
    const results = await dynamoDb.query(params);
    if (flag === 0 && results.Items.length > 0) return success(results.Items[0])
    else if (flag === 1) return results.Items.length > 0 ? results.Items[0] : null;
  }
  catch (e) {
    console.log('fetchData -> e', e);
    return failure({ status: false });
  }
}

//# Method for create admin in admin table
async function createAdmin(_1: APIGatewayEvent, adminId: string, body: Admin) {
  // we need to prevent assign same admin to other enterprise
  const adminData = await fetchAdminInfo(body.enterpriseId, adminId, 1);
  if (!adminData) {
    // and if admin is not connected with any enterprise then we should create it
    const params = {
      TableName: 'admin',
      Item: {
        enterpriseId: body.enterpriseId,
        adminId: adminId,
        administratorName: body.administratorName,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        deletedDate: null
      },
    };
    try {
      await dynamoDb.put(params);
      return success(params.Item);
    } catch (error) {
      console.log('error', error);
      return failure({ status: false });
    }
  } else {
    // admin is already created with other enterprise
    // if requested enterprise id and existing is different  
    if (body.enterpriseId === adminData.enterpriseId) return success(adminData);
    else return failure({ status: false, error: 'エンタープライズIDが一致しません。管理者に連絡してください' });
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
    // const enterpriseId = body.enterpriseId;
    const body = event.body ? JSON.parse(event.body) : {};

    if (body.type !== 'get' && body.type !== 'create') {
      const err = new Error(`invalid queryStringParameters (${body.type}).`);
      statusCode = 400;
      throw err;
    }

    if (body.type === 'create' && !body.enterpriseId) {
      const err = new Error(`invalid enterpriseId (${body.enterpriseId}).`);
      statusCode = 400;
      throw err;
    }

    const result = (body.type === 'get') ? await fetchAdminInfo(body.enterpriseId, adminId, 0) : await createAdmin(event, adminId, body); // Create admin

    if (result.body) return success(JSON.parse(result.body)); // Return the retrieved item
    else return failure({ status: false, error: 'Item not found.' }); // Return with error

  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
