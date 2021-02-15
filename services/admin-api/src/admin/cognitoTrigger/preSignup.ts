import { Context, Callback } from 'aws-lambda';

// It Will Verify Cognito User Before Enter In User And Groups
export async function main(event: any, _: Context, callback: Callback) {
    console.log("main -> event", event);
    try {        
        // Confirm the user
        event.response.autoConfirmUser = true;

        // Set the email as verified if it is in the request
        if (event.request.userAttributes.hasOwnProperty("email")) {
            event.response.autoVerifyEmail = true;
        }

        // Set the phone number as verified if it is in the request
        if (event.request.userAttributes.hasOwnProperty("phone_number")) {
            event.response.autoVerifyPhone = true;
        }
        console.log("main -> results", event);
        return callback(null,event);
    }
    catch (error) {
        console.log('error', error);
        return error("statusCode", JSON.parse(event.body!));
    }
}