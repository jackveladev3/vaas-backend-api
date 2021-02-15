import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../../libs/response-lib.js';

async function saveWhiteUploadImg(
    body: any,
    i) {
    let arrayToInsert: any = [];
    let uploadedArray: any = body.uploaded;
    let lectureId = body.lectureId;
    let userId = body.userId;
    for (let j = i * 100; j >= i * 100 && j < (i + 1) * 100 && j < uploadedArray.length; j++) {
        let uploadObject: any = {
            lectureId: lectureId,
            userId: userId,
            boardId: uploadedArray[j],
            // uploaderId: userId,
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
            'smartclass-dev-board': arrayToInsert,
        },
    };

    await dynamoDb.batchWrite(params);
    if (i < Math.floor(uploadedArray.length / 100)) {
        return await saveWhiteUploadImg(body, i + 1);
    } else {
        return ("success");
    }
}

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    try {

        const body = event.body ? JSON.parse(event.body) : {};

        await saveWhiteUploadImg(body, 0);

        // update in participant table
        let lectureId = body.lectureId;
        let userId = body.userId;
        let params = {
            TableName: 'participants',
            Key: {
                lectureId,
                userId
            },
            UpdateExpression: 'set sharedBoards = :sharedBoards, updatedDate = :updatedDate',
            ExpressionAttributeValues: {
                ':sharedBoards': body.uploaded,
                ':updatedDate': new Date().toISOString(),
            },
            ReturnValues: 'ALL_NEW'
        };
        let result = await dynamoDb.update(params)
        // ===================

        if (result) return success(result.Attributes);
        else return failure(result);

    }
    catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
