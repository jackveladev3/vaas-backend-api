import { Context, Callback } from 'aws-lambda';

// It Will Verify Cognito User Before Enter In User And Groups
export async function main(event: any, _: Context, callback: Callback) {
    try {
        if (event.triggerSource === "CustomMessage_ForgotPassword") {
            // const email = event.request.userAttributes.email;
            const passcode = event.request.codeParameter;
            const template = `SmartClassをご利用いただきありがとうございます。<br/> <br/>
            以下の認証コードを入力して、パスワードの再設定を行ってください。<br/> 
            ■認証コード：${passcode} <br/> <br/>
            ※このメールはシステムが自動的にメール送信しています。<br/>
            ※送信専用のアドレスから送られています。 <br/> 
            --------------------------------------------------
            <br/> <br/>
            SmartClass
            ${process.env.lectureBaseUrl}`;
            event.response.emailSubject = "【スマートクラス】 パスワード再設定"
            event.response.emailMessage = template;
        }
        return callback(null, event);

    }
    catch (error) {
        console.log('error', error);
        return error("statusCode", JSON.parse(event.body!));
    }
}