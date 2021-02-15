import { Context, APIGatewayEvent } from 'aws-lambda';
import  * as S3LibObj from '../../../../../libs/s3-lib.js';
import { success, error } from '../../../../../libs/response-lib.js';
import * as uuid from 'uuid';

export async function main(event: APIGatewayEvent, _: Context) {
    let statusCode = 0;
    const body = event.body ? JSON.parse(event.body) : {};
    let fileData = body.fileData;
    // Make file upload array
    let files: any = [];
    let i = 0;
    try {
        for (let file of fileData) {
            let boardId = uuid.v4();
            const Key = `${body.enterpriseId}/lectures/${body.lectureId}/${body.studentId}/sharedBoards/${boardId}.png`;
            const params = {
                Bucket: `${process.env.bucketName}`,
                Key: Key,
                Expires: 15 * 60,
                // ACL: 'bucket-owner-full-control',
                ContentType: file.contentType
            };

            let url = await S3LibObj.getPreSignedUrl('putObject', params);
            file.signedUrl = url;
            file.fileName = `${boardId}.png`;
            files[i] = file;
            i++;
        }
        // =======================
        return success({ files: files });
    } catch (err) {
        console.log('main -> err', err);
        return error(statusCode, JSON.parse(event.body!));
    }
}
