import { Context, APIGatewayEvent } from 'aws-lambda';
import dynamoDb from '../../../../libs/dynamodb-lib.js';
import { success, failure, error } from '../../../../libs/response-lib.js';
import { Tutor } from '../model/tutor';
import * as uuid from 'uuid';
import { cognitoAction } from '../../../../libs/cognito';
import utils from '../../../../libs/util.js';

export async function fetchTutorBasedOnEmail(email: string) {
  let params = {
    TableName: 'tutors',
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email
    }
  };
  try {
    const result = await dynamoDb.query(params);
    return result.Items;
  }
  catch (e) {
    console.log("fetchTutorBasedOnEmail -> e", e);
    return { message: 'Tutor not found' };
  }
}

async function updateUserInDatabase(userInfo) {
  // update user into database
  const params = {
    TableName: "tutors",
    Key: {
      tutorId: userInfo.tutorId
    },
    UpdateExpression: "SET tutorFamilyName = :tutorFamilyName, tutorFirstName = :tutorFirstName, memo = :memo, updatedDate = :updatedDate",
    ExpressionAttributeValues: {
      ":tutorFamilyName": userInfo.tutorFamilyName,
      ":tutorFirstName": userInfo.tutorFirstName,
      ":memo": userInfo.memo,
      ":updatedDate": userInfo.updatedDate,
    },
  };
  try {
    console.log("🚀 ~ file: login.ts ~ line 42 ~ updateUserInDatabase ~ params", params)
    await dynamoDb.update(params);
  } catch (e) {
    console.log("updateUserInDatabase -> e", e);
  }
}


//# Method for create participant in Tutor table
export async function createTutor(_: APIGatewayEvent, adminId, body: Tutor, type = 1) {
  let email = body.email === "" ? `${await utils.getUniqueId()}@smartclass.jp` : body.email;
  // first check same email already exist 
  let tutors: [Tutor] = await fetchTutorBasedOnEmail(email);
  console.log("🚀 ~ file: login.ts ~ line 55 ~ createTutor ~ tutors", tutors.length);
  let tutorId = tutors.length > 0 ? tutors[0].tutorId : uuid.v1();
  let tutorCreationDate = tutors.length > 0 ? tutors[0].createdDate : new Date().toISOString();
  let enterpriseId = body.enterpriseId;
  let password: string = tutors && tutors.length > 0 ? tutors[0].password : ('X' + uuid.v1());
  const params = {
    TableName: 'tutors',
    Item: {
      tutorId,
      adminId,
      enterpriseId,
      tutorFamilyName: body.tutorFamilyName,
      tutorFirstName: body.tutorFirstName,
      email: email,
      password: password,
      createdDate:  tutorCreationDate,
      updatedDate: new Date().toISOString(),
      deletedDate: null,
      lastLoginDate: new Date().toISOString(),
      memo: body.memo
    },
  };
  try {
    if (tutors.length > 0) {
      // update Tutor
      await updateUserInDatabase(params.Item)
      if (type == 1) return success(params.Item);
      else return (params.Item)
    }
    else if (!tutors.length) {
      // create new tutor in DB and Cognito
      const promise = new Promise(async (resolve, reject) => {
        //First Register in cognito
        let cUsrInfo = {
          tutorId,
          email: email,
          password: password
        }
        await cognitoAction(0, cUsrInfo, 'register', async (data) => {
          console.log("🚀 ~ file: login.ts ~ line 97 ~ awaitcognitoAction ~ data", data === null)
          if (data === null) {
            // register tutor in database
            await dynamoDb.put(params);
            resolve(data);
          }
          else if (data !== null) {
            reject(data);
          }
        });
      });
      let data = await promise;
      console.log("createTutor -> data", data);
      if (type == 1) return success(params.Item);
      else return (params.Item)
    }
    else {
      // something goes wrong
      if (type == 1) return failure({ status: false });
      else return ({ status: false });
    }
  }
  catch (error) {
    console.log("🚀 ~ file: login.ts ~ line 121 ~ createTutor ~ error", error)    
    if (type == 1) return failure({ status: false, error: error });
    else return ({ status: false, error: error });
  }
}

export async function main(event: APIGatewayEvent, _: Context) {
  console.log("🚀 ~ file: login.ts ~ line 119 ~ main ~ event", event);
  let statusCode = 0;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const adminId = event.requestContext.identity.cognitoIdentityId!.replace(
      process.env.REGION + ':',
      ''
    );
    if (!adminId) {
      const err = new Error(`invalid adminId `);
      statusCode = 400;
      throw err;
    }
    const result = await createTutor(event, adminId, body);
    if (result.body) return success(JSON.parse(result.body)); // Return the retrieved item
    else return failure({ status: false, error: 'Item not found.' }); // Return with error

  }
  catch (err) {
    console.log('main -> err', err);
    return error(statusCode, JSON.parse(event.body!));
  }
}
