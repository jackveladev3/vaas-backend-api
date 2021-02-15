import AWS from './aws-sdk';
import configs from '../config';

let s3 = null;
// Load our secret key from SSM
const ssm = new AWS.SSM();
const query = {
  Names: [configs.accessKey, configs.secretKey],
  WithDecryption: true,
};
// Load our secret key from SSM
ssm.getParameters(query, (err, data) => {
  console.log('error = %o', err);
  console.log('raw data = %o', data);
  s3 = new AWS.S3({
    signatureVersion: 'v4',
    region: 'ap-northeast-1',
    accessKeyId: data.Parameters[0].Value,
    secretAccessKey: data.Parameters[1].Value,
  });
});

export async function getPreSignedUrl(operation, params) {
  const promise = new Promise(async (resolve, _) => {
    // Load our secret key from SSM
    ssm.getParameters(query, (err, data) => {
      console.log('getPreSignedUrl -> err', err);
      console.log('error = %o', err);
      console.log('raw data = %o', data);
      s3 = new AWS.S3({
        signatureVersion: 'v4',
        region: 'ap-northeast-1',
        accessKeyId: data.Parameters[0].Value,
        secretAccessKey: data.Parameters[1].Value,
      });
      err === null ? resolve(s3.getSignedUrl(operation, params)) : resolve('');
    });
  });
  let result = await promise;
  return result;
}

export async function deleteObjectFromS3(operation, params) {
  const promise = new Promise(async (resolve, _) => {
    // Load our secret key from SSM
    ssm.getParameters(query, (err, data) => {
      console.log('error = %o', err);
      console.log('raw data = %o', data);
      s3 = new AWS.S3({
        signatureVersion: 'v4',
        region: 'ap-northeast-1',
        accessKeyId: data.Parameters[0].Value,
        secretAccessKey: data.Parameters[1].Value,
      });
      err === null ? resolve(s3.deleteObject(operation, params)) : resolve('');
    });
  });
  let result = await promise;
  return result;
}
