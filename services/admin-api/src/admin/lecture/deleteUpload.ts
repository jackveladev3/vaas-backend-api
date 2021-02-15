import { Context, APIGatewayEvent } from 'aws-lambda';
import * as S3LibObj from '../../../../../libs/s3-lib.js';
import { success, error } from '../../../../../libs/response-lib.js';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';

async function updateUploads(updatedUploadsParams: any) {
    let lectureId = updatedUploadsParams.lectureId;
    let userId = updatedUploadsParams.userId;

    var params = {
        TableName: 'participants',
        Key: {
            lectureId,
            userId,
        },
        UpdateExpression: 'set uploaded = :uploaded',
        ExpressionAttributeValues: {
            ':uploaded': updatedUploadsParams.uploaded,
        },
        ReturnValues: 'ALL_NEW'
    };
    return await dynamoDb.update(params);
}

async function setDeletedDate(fileName, userId) {

    var params = {
        TableName: 'uploads',
        Key: {
            uploadId: fileName,
            userId,
        },
        UpdateExpression: 'set deletedDate = :deletedDate',
        ExpressionAttributeValues: {
            ':deletedDate': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
    };
    let result = await dynamoDb.update(params);
    return (result && result.Attributes) ? "success" : "error";
}


export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    const body = event.body ? JSON.parse(event.body) : {};
    try {
        const Key = `${body.fileName}`;
        const params = {
            Bucket: `${process.env.bucketName}`,
            Key
        };
        await S3LibObj.deleteObjectFromS3(params);
        let result = await updateUploads(body);
        const deleteFlagRes = await setDeletedDate(body.fileName, body.userId);
        if (result.Attributes && deleteFlagRes === "success") return success(result.Attributes);
        else return error(statusCode, "something went wrong!");
    } catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
