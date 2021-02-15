import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';

async function createUpload(
  body: any,
  adminId,
  i) {
  let arrayToInsert: any = [];
  let uploadedArray: any = body.uploaded;
  let lectureId = body.lectureId;
  let studentId = body.studentId;
  for (let j = i * 100; j >= i * 100 && j < (i + 1) * 100 && j < uploadedArray.length; j++) {
    let uploadObject: any = {
      lectureId: lectureId,
      userId: studentId,
      uploadId: uploadedArray[j],
      uploaderId: adminId,
      uploaderType: 'ADMIN',
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      deletedDate: null
    };
    arrayToInsert.push({
      PutRequest: {
        Item: uploadObject,
      },
    });
  }

  if (!arrayToInsert.length) return true;

  let params = {
    RequestItems: {
      'smartclass-dev-uploads': arrayToInsert,
    },
  };

  await dynamoDb.batchWrite(params);
  if (i < Math.floor(uploadedArray.length / 100)) {
    return await createUpload(body, adminId, i + 1);
  } else {
    return ("success");
  }
}

export async function main(event: APIGatewayEvent, _: Context) {
  let statusCode = 0;
  try {
    const adminId = event.requestContext.identity.cognitoIdentityId!.replace(
      process.env.REGION + ':',
      ''
    );
    const body = event.body ? JSON.parse(event.body) : {};

    const UploadedResult = await createUpload(body, adminId, 0);
    console.log('===UploadedResult=====', UploadedResult);

    // update in participant table
    let lectureId = body.lectureId;
    let userId = body.studentId;
    let params = {
      TableName: 'participants',
      Key: {
        lectureId,
        userId
      },
      UpdateExpression: 'set uploaded = :uploaded, updatedDate = :updatedDate',
      ExpressionAttributeValues: {
        ':uploaded': body.uploaded,
        ':updatedDate': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW'
    };
    let result = await dynamoDb.update(params)
    // ===================

    if (result && result.Attributes) return success(result.Attributes);
    else return failure(result);

  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
