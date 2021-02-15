const stage = process.env.stage;
const resourcesStage = process.env.resourcesStage;

const stageConfigs = {
  dev: {
    stripeKeyName: '/stripeSecretKey/dev',
    sendGridApiKey: '/sendGridApiKey/dev',
    sendGridLectureUrl: '/sendGridApiKey/sendGridLectureUrl/dev',
    sendGridUpdateLectureUrl: '/sendGridApiKey/sendGridUpdateLectureUrl/dev',
    sendGridDeleteLectureUrl: '/sendGridApiKey/sendGridDeleteLectureUrl/dev',
    sendGridAddStudentLectureUrl:
      '/sendGridApiKey/sendGridAddStudentLectureUrl/dev',
    cognitoClientID: '/cognito/clientId/dev',
    cognitoPoolID: '/cognito/poolId/dev',
    accessKey: '/accessKey/dev',
    secretKey: '/secretKey/dev',
  },
  test: {
    stripeKeyName: '/stripeSecretKey/test',
    sendGridApiKey: '/sendGridApiKey/test',
    sendGridLectureUrl: '/sendGridApiKey/sendGridLectureUrl/test',
    accessKey: '/accessKey/dev',
    secretKey: '/secretKey/dev',
  },
  prod: {
    stripeKeyName: '/stripeSecretKey/live',
    sendGridApiKey: '/sendGridApiKey/live',
    sendGridLectureUrl: '/sendGridApiKey/sendGridLectureUrl/live',
    cognitoClientID: '/cognito/clientId/live',
    cognitoPoolID: '/cognito/poolId/live',
    accessKey: '/accessKey/dev',
    secretKey: '/secretKey/dev',
  },
};

const config = stageConfigs[stage] || stageConfigs.dev;

export default {
  stage,
  resourcesStage,
  ...config,
};
