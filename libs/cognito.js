import AWS from 'aws-sdk';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';
import fetch from 'node-fetch';
import {xmlhttprequest} from 'xmlhttprequest';
import configs from '../config';
// import dynamoDb from './dynamodb-lib.js';

// Fetch the secret value from SSM
const ssm = new AWS.SSM();
global.fetch = fetch;
global.XMLHttpRequest = xmlhttprequest;
global.navigator = () => null;
const query = {
  Names: [configs.cognitoClientID, configs.cognitoPoolID],
  WithDecryption: true,
};

function registerUser(userPool, userInfo, type, CB) {
  // First need to check user is already registered in cognito

  fetchUser(userPool, userInfo, (info) => {
    console.log('🚀 ~ file: cognito.js ~ line 26 ~ fetchUser ~ info', info);
    if (info.code === 'UserNotFoundException') {
      // build the attribute list
      let attributeList = [];
      // Register the user
      userPool.signUp(
        userInfo.email,
        userInfo.password,
        attributeList,
        null,
        function (err, result) {
          console.log('registerUser -> err', err);
          if (err) return err;
          console.log(
            'user name is ' + result.user.getUsername(),
            userPool.getUserPoolId(),
          );
          // Move to group
          let params = {
            GroupName: type === 1 ? 'STUDENT' : 'TEACHER' /* required */,
            UserPoolId: userPool.getUserPoolId() /* required */,
            Username: result.user.getUsername() /* required */,
          };
          console.log('registerUser -> params', params);
          let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
          cognitoidentityserviceprovider.adminAddUserToGroup(
            params,
            function (err, data) {
              if (err) console.log(err, err.stack);
              // an error occurred
              else CB(err); // successful response
            },
          );
          // update userName and password in DB
          // updateUserInfoInDatabase(userInfo, type);
        },
      );
    } else if (info.code === 'NotAuthorizedException') {
      // user is confirmed with other groups
      CB(`电子邮件已在其他组中注册，请尝试使用其他...`);
    }
  });
}

function updateUser(userPool, userInfo, CB) {
  loginUser(
    userPool,
    userInfo,
    (userName) => {
      console.log(
        '🚀 ~ file: cognito.js ~ line 77 ~ updateUser ~ userName',
        userName,
      );
      const params = {
        UserAttributes: [
          {
            Name: 'email',
            Value: userInfo.newEmail,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
        UserPoolId: userPool.getUserPoolId(),
        Username: userName,
      };
      var cognitoIdServiceProvider = new AWS.CognitoIdentityServiceProvider();
      cognitoIdServiceProvider.adminUpdateUserAttributes(
        params,
        function (err, data) {
          console.log('updateUser -> data', data, err);
          if (err) CB(err);
          // an error occurred
          else CB(data);
        },
      );
    },
    1,
  );
}

function fetchUser(userPool, userInfo, CB) {
  loginUser(
    userPool,
    userInfo,
    (userName) => {
      console.log(
        '🚀 ~ file: cognito.js ~ line 100 ~ fetchUser ~ userName',
        userName,
        userInfo,
      );
      CB(userName);
    },
    1,
  );
}

// async function updateUserInfoInDatabase(userInfo, type) {
//     // update user into database
//     const params = {
//         TableName: type === 0 ? "tutors" : "students",
//         Key: {
//             ...(type === 0 && {
//                 tutorId: userInfo.tutorId
//             }),
//             ...(type === 1 && {
//                 studentId: userInfo.studentId
//             })
//         },
//         UpdateExpression: "SET email = :email, password = :password",
//         ExpressionAttributeValues: {
//             ":email": userInfo.email,
//             ":password": userInfo.password
//         },
//         ReturnValues: "ALL_NEW"
//     };
//     try {
//         await dynamoDb.update(params);
//     } catch (e) {
//         console.log("storeUserInfoInDatabase -> e", e);
//     }
// }

// Login --> Callback --> jwtToken
async function loginUser(userPool, userInfo, CB, type = 0) {
  console.log('loginUser -> userPool', userInfo);
  let poolData = {
    UserPoolId: userPool.getUserPoolId(),
    ClientId: userPool.getClientId(),
  };
  let newPool = new CognitoUserPool(poolData);
  let userData = {
    Username: userInfo.email,
    Pool: newPool,
  };
  let cognitoUser = new CognitoUser(userData);
  let authenticationData = {
    Username: userInfo.email,
    Password: userInfo.password,
  };
  let authenticationDetails = new AuthenticationDetails(authenticationData);
  await cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: function (result) {
      let cognitoUser = userPool.getCurrentUser().getUsername();
      console.log('loginUser -> result', cognitoUser);
      let accessToken = result.getIdToken().getJwtToken();
      console.log('loginUser -> accessToken', accessToken);
      /* Use the idToken for Logins Map when Federating User Pools with identity pools or when passing through an Authorization Header to an API Gateway Authorizer*/
      // let idToken = result.getIdToken().getJwtToken();
      type === 0
        ? CB(accessToken)
        : CB(userPool.getCurrentUser().getUsername());
    },
    onFailure: function (err) {
      console.log('loginUser -> err', err);
      CB(err);
    },
  });
}

// type : 0 teacher, 1 student
// action : register, login, updateUser, fetchUser
// userInfo : for student {studentId, email, password}, for teacher {teacherId, email, password}
export async function cognitoAction(type, userInfo, action, CB = () => {}) {
  console.log('cognitoAction -> userInfo', userInfo);
  try {
    if (!(type <= 1 && type >= 0)) {
      const err = new Error(`invalid queryStringParameters (${type}).`);
      throw err;
    }
    // Load our secret key from SSM
    await ssm.getParameters(query, (err, data) => {
      console.log('error = %o', err);
      console.log('raw data = %o', data);
      var userPool = new CognitoUserPool({
        UserPoolId: data.Parameters[1].Value,
        ClientId: data.Parameters[0].Value,
      });
      console.log('cognitoAction -> action', action);
      switch (action) {
        case 'register':
          registerUser(userPool, userInfo, type, CB);
          break;

        case 'login':
          loginUser(userPool, userInfo, CB);
          break;

        case 'updateUser':
          updateUser(userPool, userInfo, CB);
          break;

        case 'fetchUser':
          fetchUser(userPool, userInfo, CB);
          break;

        default:
          break;
      }
    });
  } catch (err) {
    console.log('main -> err', err);
  }
}
