import AWS from 'aws-sdk';
import sgMail from '@sendgrid/mail';
import configs from '../config';
// Load our secret key from SSM
const ssm = new AWS.SSM();
const sendGridAPIPromise = ssm
  .getParameter({
    Name: configs.sendGridApiKey,
    WithDecryption: true,
  })
  .promise();
// fetch the value from SSM
sendGridAPIPromise.then((data) => {
  sgMail.setApiKey(data.Parameter.Value);
});

export default {
  sendMultipleEmailBySendGrid: async (messageArr) => {
    try {
      await sgMail.send(messageArr);

      return 1;
    } catch (err) {
      console.error(err);
      return 0;
    }
  },
  sendEmailBySendGrid: async (
    to,
    templateId,
    dynamic_template_data,
    isNotBcc = false
  ) => {
    try {
      const msg = {
        to,
        // bcc: !isNotBcc && to !== Constant.EMAIL ? [Constant.EMAIL] : undefined,
        from: `スマートクラス <no-reply@smartclass.jp>`,
        templateId: templateId,
        dynamic_template_data,
      };
      await sgMail.send(msg);
      return 1;
    } catch (err) {
      console.error(err);
      return 0;
    }
  },
  // }
};
